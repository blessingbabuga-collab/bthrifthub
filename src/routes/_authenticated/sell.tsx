import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { categories } from "@/data/products";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/sell")({
  component: SellPage,
  head: () => ({ meta: [{ title: "List a thrift item — Bthrifts" }] }),
});

function SellPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const initialForm = {
    title: "", description: "", price: "", original_price: "",
    category: "Women", condition: "Good",
    brand: "", size: "", color: "", location: "",
  };
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);

  const resetDraft = () => {
    setForm(initialForm);
    setImages([]);
    toast.success("Draft deleted");
  };

  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) { toast.error("Add at least one photo"); return; }
    setLoading(true);
    const { data, error } = await supabase.from("products").insert({
      seller_id: user.id,
      title: form.title,
      description: form.description || null,
      price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      image_url: images[0].url,
      extra_images: images.slice(1).map((i) => i.url),
      category: form.category,
      condition: form.condition,
      brand: form.brand || null,
      size: form.size || null,
      color: form.color || null,
      location: form.location || null,
    }).select("id").single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing published!");
    navigate({ to: "/product/$id", params: { id: data!.id } });
  };

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <BackButton fallback="/" />
        <h1 className="font-display text-4xl md:text-5xl">List a thrift item</h1>
        <p className="text-base text-muted-foreground mt-2">Reach buyers across Nigeria in under a minute.</p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <Field label="Product title" required>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="e.g. Vintage Levi's denim jacket" />
          </Field>
          <Field label="Photos" required hint="Upload from your gallery, files, or camera. The first photo is your cover.">
            <ImageUploader userId={user.id} value={images} onChange={setImages} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Price (₦)" required>
              <input required type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} placeholder="12000" />
            </Field>
            <Field label="Original price" optional hint="Show buyers your discount">
              <input type="number" min={0} value={form.original_price} onChange={(e) => set("original_price", e.target.value)} className={inputCls} placeholder="20000" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category" required>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Condition" required>
              <select value={form.condition} onChange={(e) => set("condition", e.target.value)} className={inputCls}>
                {["Like New", "Excellent", "Good", "Fair"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Brand" optional><input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} placeholder="Nike" /></Field>
            <Field label="Size" optional><input value={form.size} onChange={(e) => set("size", e.target.value)} className={inputCls} placeholder="M / 42" /></Field>
            <Field label="Color" optional><input value={form.color} onChange={(e) => set("color", e.target.value)} className={inputCls} placeholder="Black" /></Field>
          </div>
          <Field label="Location" optional><input value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} placeholder="Yaba, Lagos" /></Field>
          <Field label="Description" optional>
            <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls + " h-auto py-3 resize-none leading-relaxed"} placeholder="Tell buyers about fit, fabric, condition, defects…" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 pt-2">
            <button disabled={loading} type="submit" className="h-14 rounded-2xl bg-amber text-accent-foreground font-bold text-base shadow-amber disabled:opacity-60 hover:scale-[1.01] transition-transform">
              {loading ? "Uploading…" : "Upload listing"}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={loading} className="h-14 px-8 rounded-2xl border-2 border-destructive/40 text-destructive font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-60">
                  Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all the details and photos you've added. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetDraft} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, delete draft
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}

const inputCls = "w-full h-12 px-4 rounded-xl bg-input border border-border outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 text-base placeholder:text-muted-foreground/60 transition-colors";

function Field({ label, children, required, optional, hint }: { label: string; children: React.ReactNode; required?: boolean; optional?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
        {optional && <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Optional</span>}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <span className="text-xs text-muted-foreground mt-1.5 block leading-relaxed">{hint}</span>}
    </label>
  );
}