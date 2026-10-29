import { supabase } from "@/integrations/supabase/client";
import { sendEmailDirectlyViaResend } from "./resend.functions";

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
 * Dispatches an official transactional or broadcast email exclusively via Resend.
 * Uses direct TanStack Start server function with fallback to edge function.
 */
export async function sendPlatformEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  try {
    // 1. Primary path: Direct Server Function backed by Resend API
    const serverRes = await sendEmailDirectlyViaResend({ data: payload });
    if (serverRes && serverRes.success) {
      return serverRes;
    }

    // If server function returned a specific error, pass it
    if (serverRes && !serverRes.success && serverRes.error) {
      console.warn("[Resend Email] Server function returned error, trying Edge fallback:", serverRes.error);
    }

    // 2. Fallback path: Invoke edge function
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: payload,
    });

    if (error) {
      console.error("[Resend Email] Edge Invoke Error:", error);
      let detailedMsg = error.message;
      try {
        if ((error as any).context && typeof (error as any).context.json === "function") {
          const body = await (error as any).context.json();
          if (body?.error) detailedMsg = body.error;
        }
      } catch {
        // ignore
      }
      return { success: false, error: detailedMsg };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, messageId: data?.messageId };
  } catch (err: any) {
    console.error("[Resend Email] Unexpected Exception:", err);
    return { success: false, error: err?.message || "Failed to dispatch email via Resend" };
  }
}
