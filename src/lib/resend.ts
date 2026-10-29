import { supabase } from "@/integrations/supabase/client";

export interface SendEmailPayload {
  event_type: string;
  recipient_email?: string;
  variables?: Record<string, any>;
  target_order_id?: string;
  target_user_id?: string;
  subject?: string;
  html?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dispatches an official transactional or broadcast email via our Supabase Edge Function
 * backed by the Resend email infrastructure.
 */
export async function sendPlatformEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: payload,
    });

    if (error) {
      console.error("[Resend Email] Invoke Error:", error);
      // FunctionsHttpError often contains error context in error.context
      let detailedMsg = error.message;
      try {
        if ((error as any).context && typeof (error as any).context.json === "function") {
          const body = await (error as any).context.json();
          if (body?.error) detailedMsg = body.error;
        }
      } catch {
        // ignore parse error
      }
      return { success: false, error: detailedMsg };
    }

    if (data?.error) {
      console.error("[Resend Email] Service Error:", data.error);
      return { success: false, error: data.error };
    }

    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    console.error("[Resend Email] Unexpected Exception:", err);
    return { success: false, error: err?.message || "Failed to dispatch email via Resend" };
  }
}
