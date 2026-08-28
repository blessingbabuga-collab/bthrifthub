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
  shadow_banned?: boolean;
  created_at: string;
};

export const formatNaira = (n: number) => `₦${Number(n).toLocaleString("en-US")}`;

import { DUMMY_PRODUCTS, getDummyProduct, getDummySeller } from "./dummy";

export async function fetchProducts(opts: { category?: string; search?: string; limit?: number } = {}) {
  let q = supabase.from("products").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (opts.category && opts.category !== "All") q = q.eq("category", opts.category);
  if (opts.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (!error && data && data.length > 0) return data as DbProduct[];
  
  // Fallback to dummy data
  let dummies = DUMMY_PRODUCTS;
  if (opts.category && opts.category !== "All") dummies = dummies.filter(d => d.category === opts.category);
  if (opts.search) dummies = dummies.filter(d => d.title.toLowerCase().includes(opts.search!.toLowerCase()));
  if (opts.limit) dummies = dummies.slice(0, opts.limit);
  return dummies as any as DbProduct[];
}

export async function fetchProduct(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (data) return data as DbProduct;
  
  // Fallback to dummy data
  const dummy = getDummyProduct(id);
  if (dummy) return dummy as any as DbProduct;
  
  throw new Error("Product not found");
}

export async function fetchSellerProfile(sellerId: string) {
  const { data, error } = await supabase
    .from("public_seller_profiles")
    .select("id, username, avatar_url")
    .eq("id", sellerId)
    .maybeSingle();
  if (data) return data;
  
  // Fallback to dummy data
  const dummy = getDummySeller(sellerId);
  if (dummy) return dummy;
  
  throw new Error("Seller not found");
}