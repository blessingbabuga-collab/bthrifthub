import jacket from "@/assets/product-jacket.jpg";
import shoes from "@/assets/product-shoes.jpg";
import bag from "@/assets/product-bag.jpg";
import shades from "@/assets/product-shades.jpg";
import type { DbProduct } from "./products";

export const DUMMY_PRODUCTS: any[] = [
  {
    id: "d1",
    title: "Vintage Carhartt Detroit Jacket",
    description: "Authentic vintage Carhartt Detroit jacket in faded blue denim. Perfect boxy fit, slight distressing on the cuffs which adds character. Kept in a smoke-free home.",
    price: 45000,
    original_price: 85000,
    image_url: jacket,
    extra_images: [jacket, jacket],
    category: "Streetwear",
    condition: "excellent",
    size: "L",
    brand: "Carhartt",
    seller_id: "seller1",
    location: "Lagos",
    created_at: "2024-01-01T00:00:00Z",
    status: "active",
    seller: { id: "seller1", full_name: "Tomiwa A.", username: "tomiwa", avatar_url: null },
  },
  {
    id: "d2",
    title: "Jordan 4 Retro Military Black",
    description: "Lightly used Jordan 4s. 100% authentic. Comes with the original box and extra laces.",
    price: 120000,
    original_price: null,
    image_url: shoes,
    extra_images: [shoes],
    category: "Sneakers",
    condition: "good",
    size: "US 10",
    brand: "Nike",
    seller_id: "seller2",
    location: "Abuja",
    created_at: "2024-01-02T00:00:00Z",
    status: "active",
    seller: { id: "seller2", full_name: "SneakerHead NG", username: "sneakerhead", avatar_url: null },
  },
  {
    id: "d3",
    title: "Prada Nylon Mini Bag",
    description: "Classic Prada re-edition mini bag. Barely used, pristine condition.",
    price: 85000,
    original_price: 150000,
    image_url: bag,
    extra_images: [bag],
    category: "Bags",
    condition: "like_new",
    size: "One Size",
    brand: "Prada",
    seller_id: "seller3",
    location: "Lagos",
    created_at: "2024-01-03T00:00:00Z",
    status: "active",
    seller: { id: "seller3", full_name: "Amara Closet", username: "amara", avatar_url: null },
  },
  {
    id: "d4",
    title: "Gentle Monster Sunglasses",
    description: "Stylish black shades. Great for summer.",
    price: 32000,
    original_price: 45000,
    image_url: shades,
    extra_images: [shades],
    category: "Accessories",
    condition: "good",
    size: "OS",
    brand: "Gentle Monster",
    seller_id: "seller4",
    location: "Port Harcourt",
    created_at: "2024-01-04T00:00:00Z",
    status: "active",
    seller: { id: "seller4", full_name: "Kola B.", username: "kola", avatar_url: null },
  }
];

export const getDummyProduct = (id: string) => DUMMY_PRODUCTS.find(p => p.id === id);
export const getDummySeller = (id: string) => DUMMY_PRODUCTS.find(p => p.seller_id === id)?.seller;
