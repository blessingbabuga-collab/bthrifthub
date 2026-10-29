import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export interface SendEmailServerPayload {
  event_type: string;
  recipient_email?: string;
  variables?: Record<string, any>;
  target_order_id?: string;
  target_user_id?: string;
  subject?: string;
  html?: string;
}

export const sendEmailDirectlyViaResend = createServerFn({ method: "POST" })
  .validator((d: SendEmailServerPayload) => d)
  .handler(async ({ data }) => {
    try {
      const {
        event_type,
        recipient_email,
        variables = {},
        target_order_id,
        target_user_id,
        subject: customSubject,
        html: customHtml,
      } = data;

      if (!event_type) throw new Error("Missing event_type");

      // 1. Fetch dynamic platform settings for Resend
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["resend_from_name", "resend_from_email", "resend_reply_to", "resend_api_key"]);

      let resendApiKey = process.env.RESEND_API_KEY || "";
      let fromName = "BTHRIFTS";
      let fromEmail = "notifications@resend.dev";
      let replyTo: string | undefined = "support@thriftyfy.africa";

      if (settings && settings.length > 0) {
        for (const s of settings) {
          if (s.key === "resend_api_key" && s.value?.trim()) resendApiKey = s.value.trim();
          if (s.key === "resend_from_name" && s.value?.trim()) fromName = s.value.trim();
          if (s.key === "resend_from_email" && s.value?.trim()) fromEmail = s.value.trim();
          if (s.key === "resend_reply_to" && s.value?.trim()) replyTo = s.value.trim();
        }
      }

      if (!resendApiKey) {
        throw new Error(
          "No Resend API Key found! Please set your Resend API Key in /admin -> Resend Settings."
        );
      }

      let finalEmail = recipient_email;
      let finalVariables = { ...variables };

      // Auto-resolve order emails
      if (target_order_id && ["order_shipped", "order_delivered", "order_paid_buyer", "order_paid_seller"].includes(event_type)) {
        const { data: order } = await supabase
          .from("orders")
          .select(`
            id, buyer_id, full_name, total, tracking_code, delivery_otp,
            order_items ( title, unit_price, quantity, seller_id )
          `)
          .eq("id", target_order_id)
          .single();

        if (order) {
          if (event_type === "order_paid_seller") {
            const sellerId = order.order_items[0]?.seller_id;
            const { data: sellerProf } = await (supabase as any).from("profiles").select("business_name, full_name").eq("id", sellerId).single();
            finalVariables = {
              ...finalVariables,
              seller_name: sellerProf?.business_name || sellerProf?.full_name || "Merchant",
              product_name: order.order_items[0]?.title || "your product",
              tracking_code: order.tracking_code || order.id.slice(0, 8),
            };
          } else {
            finalVariables = {
              ...finalVariables,
              buyer_name: order.full_name,
              product_name: order.order_items[0]?.title || "your items",
              order_id: order.id,
              tracking_code: order.tracking_code || order.id.slice(0, 8),
              delivery_otp: order.delivery_otp || "------",
              total_amount: Number(order.total).toLocaleString(),
            };
          }
        }
      }

      let subject = customSubject;
      let html = customHtml;

      if (!subject || !html) {
        const { data: template } = await (supabase as any)
          .from("email_templates")
          .select("subject, body_html")
          .eq("event_type", event_type)
          .single();

        if (template) {
          subject = subject || template.subject;
          html = html || template.body_html;
        }
      }

      if (!subject || !html) {
        throw new Error(`Email subject or template body not found for event: ${event_type}`);
      }

      if (!finalEmail) {
        throw new Error("Missing recipient email address");
      }

      // Replace template variables
      for (const [key, value] of Object.entries(finalVariables)) {
        const regex = new RegExp(`{{${key}}}`, "g");
        subject = subject.replace(regex, String(value));
        html = html.replace(regex, String(value));
      }

      // 2. Dispatch via Resend API directly
      const payload: Record<string, any> = {
        from: `${fromName} <${fromEmail}>`,
        to: [finalEmail],
        subject: subject,
        html: html,
      };

      if (replyTo) {
        payload.reply_to = replyTo;
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
        throw new Error(`Resend API Error: ${resData.message || JSON.stringify(resData)}`);
      }

      return { success: true, messageId: resData.id, provider: "resend" };
    } catch (err: any) {
      console.error("[sendEmailDirectlyViaResend] Error:", err);
      return { success: false, error: err?.message || "Failed to send email via Resend" };
    }
  });
