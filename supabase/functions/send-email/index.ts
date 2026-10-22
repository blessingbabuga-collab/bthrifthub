import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.7";

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

    // 1. Fetch template from DB
    const { data: template, error: tmplError } = await supabase
      .from("email_templates")
      .select("subject, body_html")
      .eq("event_type", event_type)
      .single();

    if (tmplError || !template) {
      throw new Error(`Template not found for event: ${event_type}`);
    }

    // 2. Replace variables in template
    let subject = template.subject;
    let html = template.body_html;
    for (const [key, value] of Object.entries(finalVariables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, String(value));
      html = html.replace(regex, String(value));
    }

    // 3. Dispatch Email (Supports RESEND_API_KEY with GMAIL SMTP Fallback)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const gmailUser = Deno.env.get("GMAIL_ADDRESS");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (resendApiKey) {
      const fromEmail = Deno.env.get("FROM_EMAIL") || "orders@thriftyfy.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `BTHRIFTS <${fromEmail}>`,
          to: [finalEmail],
          subject: subject,
          html: html,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(`Resend email error: ${resData.message || JSON.stringify(resData)}`);
      }

      return new Response(JSON.stringify({ success: true, messageId: resData.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!gmailUser || !gmailPass) {
      throw new Error("Missing email credentials. Please configure RESEND_API_KEY or GMAIL_ADDRESS & GMAIL_APP_PASSWORD in Supabase Edge Secrets.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const info = await transporter.sendMail({
      from: `"BTHRIFTS" <${gmailUser}>`,
      to: finalEmail,
      subject: subject,
      html: html,
    });

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
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
