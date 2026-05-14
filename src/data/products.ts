import bag from "@/assets/product-bag.jpg";
import shoes from "@/assets/product-shoes.jpg";
import jacket from "@/assets/product-jacket.jpg";
import shades from "@/assets/product-shades.jpg";

export type Product = {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  seller: string;
  location: string;
  condition: "Like New" | "Excellent" | "Good";
  category: string;
  rating: number;
};

export const products: Product[] = [
  { id: "p1", title: "Vintage Leather Tote", price: 12500, originalPrice: 22000, image: bag, seller: "Lagos Thrifts", location: "Yaba, Lagos", condition: "Excellent", category: "Bags", rating: 4.8 },
  { id: "p2", title: "Retro Canvas Sneakers", price: 7800, originalPrice: 15000, image: shoes, seller: "SoleMate NG", location: "Wuse, Abuja", condition: "Like New", category: "Shoes", rating: 4.9 },
  { id: "p3", title: "Classic Denim Jacket", price: 9500, image: jacket, seller: "Thrift Republic", location: "Surulere, Lagos", condition: "Excellent", category: "Outerwear", rating: 4.7 },
  { id: "p4", title: "Gold Round Sunglasses", price: 4200, originalPrice: 8000, image: shades, seller: "Cool Eyes", location: "Port Harcourt", condition: "Like New", category: "Accessories", rating: 4.6 },
  { id: "p5", title: "Premium Crossbody Bag", price: 11000, image: bag, seller: "Naija Vintage", location: "Ikeja, Lagos", condition: "Good", category: "Bags", rating: 4.5 },
  { id: "p6", title: "Suede Low-Tops", price: 8900, image: shoes, seller: "SoleMate NG", location: "Wuse, Abuja", condition: "Excellent", category: "Shoes", rating: 4.8 },
];

export const categories = [
  { name: "Women", emoji: "👗" },
  { name: "Men", emoji: "👔" },
  { name: "Shoes", emoji: "👟" },
  { name: "Bags", emoji: "👜" },
  { name: "Accessories", emoji: "🕶️" },
  { name: "Lifestyle", emoji: "🏺" },
];

export const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
