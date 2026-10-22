import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MINIMUM_WITHDRAWAL_NGN = 1000;
const MAXIMUM_SINGLE_WITHDRAWAL_NGN = 500000; // anti-drain velocity limit per transaction

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Verify user JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { amount } = await req.json();
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount < MINIMUM_WITHDRAWAL_NGN) {
      throw new Error(`Minimum withdrawal amount is ₦${MINIMUM_WITHDRAWAL_NGN.toLocaleString()}`);
    }
    if (withdrawAmount > MAXIMUM_SINGLE_WITHDRAWAL_NGN) {
      throw new Error(`Maximum single withdrawal limit is ₦${MAXIMUM_SINGLE_WITHDRAWAL_NGN.toLocaleString()}. Contact support for larger payouts.`);
    }

    // 2. Fetch verified bank account
    const { data: bank, error: bankError } = await supabaseAdmin
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (bankError || !bank) {
      throw new Error("No verified bank account found. Please complete store bank setup first.");
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Paystack secret configuration missing");

    // 3. Atomically Lock & Debit Wallet Balance in DB First
    // (Prevents Race-Condition Double Withdrawals / Concurrent Replay Attacks)
    const txDescription = `Withdrawal to ${bank.bank_name} - ${bank.account_number.slice(-4)}`;
    const { data: debitResult, error: debitError } = await supabaseAdmin.rpc("debit_wallet_for_withdrawal", {
      p_user_id: user.id,
      p_amount: withdrawAmount,
      p_description: txDescription,
    });

    if (debitError || !debitResult?.success) {
      throw new Error(debitResult?.message || debitError?.message || "Failed to debit wallet balance");
    }

    const walletId = debitResult.wallet_id;
    const txId = debitResult.transaction_id;

    // 4. Create or Resolve Transfer Recipient on Paystack
    let recipient_code = bank.paystack_recipient_code;
    if (!recipient_code) {
      const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: bank.account_name,
          account_number: bank.account_number,
          bank_code: bank.bank_code,
          currency: "NGN",
        }),
      });

      const recipientData = await recipientRes.json();
      if (!recipientData.status) {
        // Rollback debit before failing
        await supabaseAdmin.rpc("rollback_failed_withdrawal", {
          p_wallet_id: walletId,
          p_amount: withdrawAmount,
          p_reason: `Recipient registration failed: ${recipientData.message}`,
        });
        throw new Error(`Paystack recipient error: ${recipientData.message}`);
      }

      recipient_code = recipientData.data.recipient_code;

      // Cache recipient code on bank_accounts table if column exists
      try {
        await supabaseAdmin
          .from("bank_accounts")
          .update({ paystack_recipient_code: recipient_code })
          .eq("id", bank.id);
      } catch (_) {
        // non-blocking
      }
    }

    // 5. Initiate Transfer with Unique Idempotency Reference
    const transferRef = `WTH-${txId.slice(0, 8)}-${Date.now()}`;
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(withdrawAmount * 100), // convert to kobo as integer
        recipient: recipient_code,
        reference: transferRef,
        reason: "BTHRIFTS Merchant Payout",
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      // Rollback database debit if Paystack rejects the transfer
      await supabaseAdmin.rpc("rollback_failed_withdrawal", {
        p_wallet_id: walletId,
        p_amount: withdrawAmount,
        p_reason: `Paystack rejected transfer: ${transferData.message}`,
      });
      throw new Error(`Paystack transfer error: ${transferData.message}`);
    }

    // 6. Send transactional notification email for withdrawal
    try {
      await supabaseAdmin.functions.invoke("send-email", {
        body: {
          event_type: "payout_completed",
          recipient_email: user.email,
          variables: {
            user_name: bank.account_name,
            amount: withdrawAmount.toLocaleString(),
            bank_name: bank.bank_name,
            account_last4: bank.account_number.slice(-4),
            transfer_reference: transferRef,
          },
        },
      });
    } catch (emailErr) {
      console.warn("Could not dispatch payout email:", emailErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      reference: transferRef,
      message: "Withdrawal processed successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
