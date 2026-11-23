import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type GiftListing = Database["public"]["Tables"]["gift_listings"]["Row"];
export type GiftListingInsert = Database["public"]["Tables"]["gift_listings"]["Insert"];
export type GiftListingUpdate = Database["public"]["Tables"]["gift_listings"]["Update"];

export type GiftApplication = Database["public"]["Tables"]["gift_applications"]["Row"];
export type GiftApplicationInsert = Database["public"]["Tables"]["gift_applications"]["Insert"];
export type GiftApplicationUpdate = Database["public"]["Tables"]["gift_applications"]["Update"];

export type GiftHandover = Database["public"]["Tables"]["gift_handovers"]["Row"];
export type GiftHandoverInsert = Database["public"]["Tables"]["gift_handovers"]["Insert"];

export type GiftReport = Database["public"]["Tables"]["gift_reports"]["Row"];
export type GivingNotification = Database["public"]["Tables"]["notifications"]["Row"];

export const GIFT_CATEGORIES = [
  "Women",
  "Men",
  "Kids & Babies",
  "Shoes",
  "Bags",
  "Accessories",
  "Home & Living",
  "Gadgets & Tech",
  "Books & Stationery",
  "Other",
] as const;

export const GIFT_CONDITIONS = [
  "Brand New / Unused",
  "Like New",
  "Excellent",
  "Good",
  "Gently Used",
] as const;

export interface FetchGiftsParams {
  category?: string;
  condition?: string;
  city?: string;
  search?: string;
  status?: GiftListing["status"];
  limit?: number;
}

/**
 * Check if public "Find a Gift" browsing is enabled by admin
 */
export async function fetchFindGiftEnabled(): Promise<boolean> {
  const { data } = await (supabase as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "giving_find_gift_enabled")
    .maybeSingle();

  return data?.value === "true";
}

/**
 * Fetch published gifts for browsing with giver profile
 */
export async function fetchPublishedGifts(params?: FetchGiftsParams) {
  let query = (supabase as any)
    .from("gift_listings")
    .select(`
      *,
      giver:profiles!gift_listings_giver_id_fkey(
        id,
        username,
        avatar_url
      )
    `)
    .in("status", ["published", "applications_closed", "awarded", "completed"])
    .order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }
  if (params?.category && params.category !== "All") {
    query = query.eq("category", params.category);
  }
  if (params?.condition && params.condition !== "All") {
    query = query.eq("condition", params.condition);
  }
  if (params?.city) {
    query = query.ilike("location", `%${params.city}%`);
  }
  if (params?.search) {
    query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%,brand.ilike.%${params.search}%`);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Fetch a single gift by ID
 */
export async function fetchGiftById(id: string) {
  const { data, error } = await (supabase as any)
    .from("gift_listings")
    .select(`
      *,
      giver:profiles!gift_listings_giver_id_fkey(
        id,
        username,
        avatar_url
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch applications submitted by the current user
 */
export async function fetchMyGiftApplications(userId: string) {
  const { data, error } = await (supabase as any)
    .from("gift_applications")
    .select(`
      *,
      gift:gift_listings!gift_applications_gift_id_fkey(
        id,
        title,
        images,
        category,
        condition,
        location,
        status,
        deadline,
        giver_id,
        giver:profiles!gift_listings_giver_id_fkey(
          id,
          username,
          avatar_url
        )
      )
    `)
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch gifts created by the current user (Giver)
 */
export async function fetchMyGifts(userId: string) {
  const { data, error } = await (supabase as any)
    .from("gift_listings")
    .select(`
      *,
      gift_applications!gift_applications_gift_id_fkey(
        id,
        status
      )
    `)
    .eq("giver_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch all applications for a specific gift (Giver dashboard)
 */
export async function fetchApplicationsForGift(giftId: string) {
  const { data, error } = await (supabase as any)
    .from("gift_applications")
    .select(`
      *,
      applicant:profiles!gift_applications_applicant_id_fkey(
        id,
        username,
        full_name,
        avatar_url,
        created_at
      )
    `)
    .eq("gift_id", giftId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch handover details for a gift (Giver and Selected Recipient only)
 */
export async function fetchGiftHandover(giftId: string) {
  const { data, error } = await (supabase as any)
    .from("gift_handovers")
    .select(`
      *,
      gift:gift_listings(
        id,
        title,
        images,
        status,
        giver_id
      ),
      giver:profiles!gift_handovers_giver_id_fkey(
        id,
        username,
        full_name,
        avatar_url
      ),
      recipient:profiles!gift_handovers_recipient_id_fkey(
        id,
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("gift_id", giftId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetch notifications for a user
 */
export async function fetchUserNotifications(userId: string) {
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
}

/**
 * Submit report on gift listing or application
 */
export async function submitGiftReport(report: {
  reporter_id: string;
  gift_id?: string;
  application_id?: string;
  reason: string;
  details?: string;
}) {
  const { data, error } = await (supabase as any)
    .from("gift_reports")
    .insert(report)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send Giving In-App Notification helper
 */
export async function sendGivingNotification(payload: {
  user_id: string;
  title: string;
  message: string;
  link_url?: string;
  entity_id?: string;
}) {
  const { error } = await (supabase as any).from("notifications").insert({
    user_id: payload.user_id,
    title: payload.title,
    message: payload.message,
    type: "giving",
    link_url: payload.link_url || null,
    entity_id: payload.entity_id || null,
  });
  if (error) console.error("Failed to insert notification:", error);
}
