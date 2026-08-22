import { supabase } from "@/integrations/supabase/client";

export type DbProduct = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string;
  extra_images: string[];
  category: string;
  condition: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  location: string | null;
  status: string;
  created_at: string;
};

export const formatNaira = (n: number) => `₦${Number(n).toLocaleString("en-NG")}`;

export async function fetchProducts(opts: { category?: string; search?: string; limit?: number } = {}) {
  let q = supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (opts.category && opts.category !== "All") q = q.eq("category", opts.category);
  if (opts.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data as DbProduct[];
}

export async function fetchProduct(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) throw error;
  return data as DbProduct;
}

export async function fetchSellerProfile(sellerId: string) {
  const { data, error } = await supabase
    .from("public_seller_profiles")
    .select("id, username, avatar_url")
    .eq("id", sellerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}