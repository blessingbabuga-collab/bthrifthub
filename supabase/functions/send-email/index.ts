import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Allow providing recipient_email + variables directly, OR target_order_id to auto-resolve
    const { event_type, recipient_email, variables, target_order_id, target_user_id } = await req.json();

    if (!event_type) throw new Error("Missing event_type");

    let finalEmail = recipient_email;
    let finalVariables = variables || {};

    // Auto-resolve order emails
    if (target_order_id && (event_type === "order_shipped" || event_type === "order_delivered" || event_type === "order_paid_buyer" || event_type === "order_paid_seller")) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select(`
          id, buyer_id, full_name, total, tracking_code, delivery_otp,
          order_items ( title, unit_price, quantity, seller_id )
        `)
        .eq("id", target_order_id)
        .single();
      
      if (orderErr || !order) throw new Error("Order not found");

      if (event_type === "order_paid_seller") {
        const sellerId = order.order_items[0]?.seller_id;
        if (!sellerId) throw new Error("Seller ID not found on order");
        const { data: sellerData, error: sellerErr } = await supabase.auth.admin.getUserById(sellerId);
        if (sellerErr || !sellerData.user) throw new Error("Seller email not found");
        const { data: sellerProfile } = await supabase.from("profiles").select("store_name, full_name").eq("id", sellerId).single();

        finalEmail = sellerData.user.email;
        const totalItemsAmount = order.order_items.reduce((s: number, i: any) => s + (Number(i.unit_price) * i.quantity), 0);
        
        // Fetch dynamic platform commission
        const { data: settingData } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "platform_commission_percent")
          .maybeSingle();
        const commissionRate = settingData?.value ? Number(settingData.value) / 100 : 0.08;
        const netEarnings = Math.round(totalItemsAmount * (1 - commissionRate));

        finalVariables = {
          seller_name: sellerProfile?.store_name || sellerProfile?.full_name || "Merchant",
          product_name: order.order_items[0]?.title || "your product",
          tracking_code: order.tracking_code || order.id.slice(0, 8),
          net_amount: netEarnings.toLocaleString(),
        };
      } else {
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(order.buyer_id);
        if (userErr || !userData.user) throw new Error("Buyer email not found");

        finalEmail = userData.user.email;
        finalVariables = {
          buyer_name: order.full_name,
          product_name: order.order_items[0]?.title || "your items",
          order_id: order.id,
          tracking_code: order.tracking_code || order.id.slice(0, 8),
          delivery_otp: order.delivery_otp || "------",
          total_amount: Number(order.total).toLocaleString(),
          tracking_info: "Direct Merchant Delivery",
        };
      }
    }

    // Auto-resolve withdrawal emails
    if (target_user_id && event_type === "withdrawal_requested") {
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(target_user_id);
      if (userErr || !userData.user) throw new Error("User email not found");
      
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", target_user_id).single();
      
      finalEmail = userData.user.email;
      finalVariables = {
        user_name: profile?.full_name || "User",
        amount: finalVariables.amount || "your requested amount",
      };
    }

    if (!finalEmail) {
      throw new Error("Missing or unresolvable recipient_email");
    }

    // 1. Fetch template from DB (or allow direct subject & html)
    const { subject: directSubject, html: directHtml } = await req.clone().json().catch(() => ({}));
    let subject = directSubject;
    let html = directHtml;

    if (!subject || !html) {
      const { data: template, error: tmplError } = await supabase
        .from("email_templates")
        .select("subject, body_html")
        .eq("event_type", event_type)
        .single();

      if (tmplError || !template) {
        throw new Error(`Template not found for event: ${event_type}`);
      }

      subject = template.subject;
      html = template.body_html;
    }

    // 2. Replace variables in template
    for (const [key, value] of Object.entries(finalVariables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, String(value));
      html = html.replace(regex, String(value));
    }

    // 3. Fetch official Resend configuration from platform_settings
    let platformFromName = "BTHRIFTS";
    let platformFromEmail = Deno.env.get("FROM_EMAIL") || "notifications@resend.dev";
    let platformReplyTo: string | undefined = "support@thriftyfy.africa";
    let dbResendApiKey: string | undefined;

    try {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["resend_from_name", "resend_from_email", "resend_reply_to", "resend_api_key"]);

      if (settings && settings.length > 0) {
        for (const s of settings) {
          if (s.key === "resend_from_name" && s.value?.trim()) platformFromName = s.value.trim();
          if (s.key === "resend_from_email" && s.value?.trim()) platformFromEmail = s.value.trim();
          if (s.key === "resend_reply_to" && s.value?.trim()) platformReplyTo = s.value.trim();
          if (s.key === "resend_api_key" && s.value?.trim()) dbResendApiKey = s.value.trim();
        }
      }
    } catch (sErr) {
      console.warn("Could not load dynamic platform_settings for Resend:", sErr);
    }

    // 4. Dispatch Email exclusively via Resend (Single official communication channel)
    const resendApiKey = dbResendApiKey || Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error(
        "Missing Resend API Key. Please provide your Resend API Key in Admin Settings -> Resend Settings (or set RESEND_API_KEY in Supabase Edge Secrets)."
      );
    }

    const payload: Record<string, any> = {
      from: `${platformFromName} <${platformFromEmail}>`,
      to: [finalEmail],
      subject: subject,
      html: html,
    };

    if (platformReplyTo) {
      payload.reply_to = platformReplyTo;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend email error: ${resData.message || JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, messageId: resData.id, provider: "resend" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
