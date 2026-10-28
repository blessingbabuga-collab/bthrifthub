import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OpenWhatsAppOptions {
  orderId: string;
  orderTrackingCode?: string;
  itemTitle?: string;
  targetUserId?: string;
  defaultRole?: "seller" | "buyer";
  fallbackPhone?: string;
}

export async function openOrderWhatsAppChat({
  orderId,
  orderTrackingCode,
  itemTitle,
  targetUserId,
  defaultRole,
  fallbackPhone,
}: OpenWhatsAppOptions) {
  try {
    // Call our secure RPC to retrieve contact details
    let phone: string | null = null;
    let contactRole: string = defaultRole || "seller";

    const { data, error } = await (supabase.rpc as any)("get_order_chat_contact", {
      p_order_id: orderId,
      p_target_user_id: targetUserId || null,
    });

    if (error) {
      console.warn("RPC get_order_chat_contact not active or returned error, falling back:", error);
    } else if (data && typeof data === "object") {
      if (!data.success && data.error) {
        toast.info(data.error);
        return;
      }
      phone = data.phone_number;
      if (data.role) contactRole = data.role;
    }

    // Direct fallback if RPC hasn't been migrated yet in active instance
    if (!phone && fallbackPhone) {
      phone = fallbackPhone;
    }

    if (!phone && targetUserId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone_number")
        .eq("id", targetUserId)
        .maybeSingle();
      phone = (prof as any)?.phone_number;
    }

    const cleanPhone = phone?.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.info(
        contactRole === "buyer"
          ? "The buyer has not provided a valid phone number for WhatsApp."
          : "This seller hasn't added a WhatsApp phone number yet."
      );
      return;
    }

    const intl = cleanPhone.startsWith("234")
      ? cleanPhone
      : cleanPhone.startsWith("0")
      ? "234" + cleanPhone.slice(1)
      : "234" + cleanPhone;

    let text = "";
    if (contactRole === "buyer") {
      text = `Hi! I am the seller for your order ${orderTrackingCode ? `#${orderTrackingCode}` : ""} ${
        itemTitle ? `("${itemTitle}")` : ""
      } on Thriftyfy/Bthrifts. Reaching out regarding your confirmed order!`;
    } else {
      text = `Hi! I'm reaching out regarding my confirmed order ${orderTrackingCode ? `#${orderTrackingCode}` : ""} ${
        itemTitle ? `for "${itemTitle}"` : ""
      } on Thriftyfy/Bthrifts.`;
    }

    const msg = encodeURIComponent(text);
    window.open(`https://wa.me/${intl}?text=${msg}`, "_blank", "noopener");
  } catch (e: any) {
    console.error("Failed to open WhatsApp chat:", e);
    toast.error("Could not load chat details. Please try again.");
  }
}
