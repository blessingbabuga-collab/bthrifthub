import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("Missing PAYSTACK_SECRET_KEY");
      return new Response("Server configuration error", { status: 500 });
    }

    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const rawBody = await req.text();

    // Verify HMAC-SHA512 signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["verify"]
    );

    // Convert hex signature to Uint8Array
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(rawBody)
    );

    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack Webhook Event:", event.event);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle Transfer Events
    if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
      const transferData = event.data;
      const transferCode = transferData.transfer_code || transferData.reference;
      const amount = (transferData.amount || 0) / 100; // convert kobo to NGN

      console.warn(`Transfer ${transferCode} failed/reversed. Processing refund to wallet...`);

      // Find the recipient's bank account to link back to the user/wallet
      const recipientCode = transferData.recipient?.recipient_code;
      if (recipientCode) {
        // Query transaction matching this description or reference
        const { data: txList } = await supabaseAdmin
          .from("transactions")
          .select("id, wallet_id")
          .eq("type", "withdrawal")
          .order("created_at", { ascending: false })
          .limit(1);

        if (txList && txList.length > 0) {
          const walletId = txList[0].wallet_id;
          // Re-credit the available balance via a refund transaction
          await supabaseAdmin.from("transactions").insert({
            wallet_id: walletId,
            type: "refund",
            amount: amount,
            net_amount: amount,
            status: "completed",
            description: `Transfer failed (${transferData.reason || "Bank bounce"}). Funds returned to wallet.`,
          });

          // Adjust balances (decrease withdrawn_balance, increase available_balance)
          const { data: wallet } = await supabaseAdmin.from("wallets").select("*").eq("id", walletId).single();
          if (wallet) {
            await supabaseAdmin.from("wallets").update({
              available_balance: Number(wallet.available_balance) + amount,
              withdrawn_balance: Math.max(0, Number(wallet.withdrawn_balance) - amount),
            }).eq("id", walletId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Webhook error";
    console.error("Paystack webhook processing error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
});
