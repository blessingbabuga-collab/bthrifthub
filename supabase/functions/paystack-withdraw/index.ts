import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Auth header");
    
    // Setup Supabase admin client to bypass RLS for secure checks
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { amount } = await req.json();
    if (!amount || isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

    // Get user wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (walletError || !wallet) throw new Error("Wallet not found");

    if (Number(wallet.available_balance) < amount) {
      throw new Error("Insufficient available balance");
    }

    // Get user bank account
    const { data: bank, error: bankError } = await supabaseAdmin
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (bankError || !bank) throw new Error("No verified bank account found. Complete store setup first.");

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Paystack key missing");

    // 1. Create Transfer Recipient
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
    if (!recipientData.status) throw new Error(`Paystack recipient error: ${recipientData.message}`);
    const recipient_code = recipientData.data.recipient_code;

    // 2. Initiate Transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // kobo
        recipient: recipient_code,
        reason: "BTHRIFTS Wallet Withdrawal",
      }),
    });

    const transferData = await transferRes.json();
    if (!transferData.status) throw new Error(`Paystack transfer error: ${transferData.message}`);

    // 3. Insert transaction (this triggers the wallet update)
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        wallet_id: wallet.id,
        type: "withdrawal",
        amount: amount,
        net_amount: amount, // ignoring Paystack transfer fees for this MVP logic, or deduct from amount
        status: "completed", // Note: Paystack transfers can be pending, simplified to completed for MVP
        description: `Withdrawal to ${bank.bank_name} - ${bank.account_number.slice(-4)}`,
      });

    if (txError) throw new Error(`Database error saving transaction: ${txError.message}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
