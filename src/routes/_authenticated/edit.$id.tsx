import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { MobileNav } from '@/components/MobileNav'
import { BackButton } from '@/components/BackButton'
import { ImageUploader } from '@/components/ImageUploader'
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
} from '@/components/ui/alert-dialog'


export const Route = createFileRoute('/_authenticated/edit/$id')({
  component: EditProductRoute,
})

const initialForm = {
  title: "", description: "", price: "", original_price: "",
  category: "Women", condition: "Like New", brand: "", size: "", color: "", location: "",
  is_private: false
};

function EditProductRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [form, setForm] = React.useState(initialForm);
  const [images, setImages] = React.useState<{ url: string, path: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isFetching, setIsFetching] = React.useState(true);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('categories').select('*').order('name');
      if (error) throw error;
      return data as { id: string, name: string, image_url: string }[];
    }
  });


  React.useEffect(() => {
    async function loadProduct() {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error || !data) {
        toast.error("Could not load product");
        navigate({ to: "/profile" });
        return;
      }
      if (data.seller_id !== user?.id) {
        toast.error("Unauthorized");
        navigate({ to: "/profile" });
        return;
      }
      
      setForm({
        title: data.title || "",
        description: data.description || "",
        price: data.price ? String(data.price) : "",
        original_price: data.original_price ? String(data.original_price) : "",
        category: data.category || "Women",
        condition: data.condition || "Like New",
        brand: data.brand || "",
        size: data.size || "",
        color: data.color || "",
        location: data.location || "",
        // @ts-expect-error
        is_private: data.is_private || false
      });

      const loadedImages = [];
      if (data.image_url) loadedImages.push({ url: data.image_url, path: '' });
      if (data.extra_images) loadedImages.push(...data.extra_images.map(url => ({ url, path: '' })));
      setImages(loadedImages as any);
      
      setIsFetching(false);
    }
    if (user?.id) loadProduct();
  }, [id, user?.id, navigate]);

  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const setBoolean = (k: keyof typeof form, v: boolean) => setForm((s) => ({ ...s, [k]: v }));
  
  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success('Listing deleted completely');
    navigate({ to: '/profile' });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) { toast.error("Add at least one photo"); return; }
    setLoading(true);
    
    const { error } = await supabase.from("products").update({
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
      // @ts-expect-error
      is_private: form.is_private,
    }).eq('id', id);
    
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    
    toast.success("Listing updated successfully!");
    navigate({ to: "/product/$id", params: { id } });
  };

  if (isFetching) {
    return <div className="min-h-screen pb-20 sm:pb-0 flex flex-col"><SiteHeader /><div className="flex-1 flex justify-center py-20 text-muted-foreground">Loading product...</div><MobileNav /></div>
  }

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <BackButton fallback={`/product/${id}`} />
        <h1 className="font-display text-4xl md:text-5xl">Edit listing</h1>
        <p className="text-base text-muted-foreground mt-2">Update your product details and photos.</p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <Field label="Product title" required>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="e.g. Vintage Levi's denim jacket" />
          </Field>
          <Field label="Photos" required hint="Upload from your gallery, files, or camera. The first photo is your cover.">
            <ImageUploader userId={user!.id} value={images} onChange={setImages} />
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
          
          <div className="bg-secondary/50 rounded-2xl p-5 border border-border">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.is_private}
                onChange={(e) => setBoolean("is_private", e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-amber text-amber focus:ring-amber/20 bg-background"
              />
              <div>
                <span className="block font-semibold text-foreground">Make this product private</span>
                <span className="block text-sm text-muted-foreground mt-0.5">
                  Only you will be able to see this product. It will be hidden from the public marketplace, but its price will still be calculated towards your total Wardrobe Value.
                </span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 pt-4">
            <button disabled={loading} type="submit" className="h-14 rounded-full bg-primary text-primary-foreground font-display font-bold uppercase tracking-widest text-lg shadow-glow disabled:opacity-60 hover:opacity-90 active:scale-95 transition-all">
              {loading ? "Updating…" : "Update Listing"}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={loading} className="h-14 px-8 rounded-full border border-destructive/40 text-destructive font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-60">
                  Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this listing completely?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the product from BTHRIFTS. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep product</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, delete it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" disabled={loading} className="h-14 px-8 rounded-full border border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-60">
                  Cancel
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your unsaved edits will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep editing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => navigate({ to: `/product/${id}` })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Discard edits
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

const inputCls = "w-full h-14 px-5 rounded-2xl bg-secondary/30 border border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground/60 transition-colors";

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
