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
    if (target_order_id && (event_type === "order_shipped" || event_type === "order_delivered")) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select(`
          id, buyer_id, full_name,
          order_items ( title )
        `)
        .eq("id", target_order_id)
        .single();
      
      if (orderErr || !order) throw new Error("Order not found");

      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(order.buyer_id);
      if (userErr || !userData.user) throw new Error("Buyer email not found");

      finalEmail = userData.user.email;
      finalVariables = {
        buyer_name: order.full_name,
        product_name: order.order_items[0]?.title || "your items",
        order_id: order.id,
        tracking_info: "Standard Delivery",
      };
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

    // 3. Setup Nodemailer
    const user = Deno.env.get("GMAIL_ADDRESS");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!user || !pass) {
      throw new Error("Missing GMAIL_ADDRESS or GMAIL_APP_PASSWORD secrets");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    // 4. Send Email
    const info = await transporter.sendMail({
      from: `"Thriftyfy" <${user}>`,
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
