import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileNav } from "@/components/MobileNav";
import { BackButton } from "@/components/BackButton";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { GIFT_CATEGORIES, GIFT_CONDITIONS } from "@/lib/giving";
import { sendPlatformEmail } from "@/lib/resend";
import { Sparkles, Gift, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/giving/create")({
  component: GiveGiftPage,
  head: () => ({
    meta: [
      { title: "Give a Gift — Christmas Giving — BTHRIFTS" },
      { name: "description", content: "Publish an item to give away this Christmas. All gifts are 100% free." },
    ],
  }),
});

function GiveGiftPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: GIFT_CATEGORIES[0],
    condition: GIFT_CONDITIONS[1],
    brand: "",
    size: "",
    color: "",
    specifications: "",
    intended_beneficiary_description: "",
    location: "",
    deadline: "",
  });

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key: keyof typeof form, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!user) {
      toast.error("Please log in to give a gift");
      navigate({ to: "/auth" });
      return;
    }

    if (!form.title.trim()) {
      toast.error("Please enter a gift title");
      return;
    }

    if (status === "published" && images.length === 0) {
      toast.error("Please add at least one photograph for published gifts");
      return;
    }

    if (status === "published" && !form.location.trim()) {
      toast.error("Please specify your collection city or area");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        giver_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        condition: form.condition,
        images: images.map((img) => img.url),
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
        color: form.color.trim() || null,
        specifications: form.specifications.trim() || null,
        intended_beneficiary_description: form.intended_beneficiary_description.trim() || null,
        location: form.location.trim(),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        status,
      };

      const { data, error } = await (supabase as any)
        .from("gift_listings")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      if (status === "published") {
        if (user.email) {
          sendPlatformEmail({
            event_type: "gift_published_thanks",
            recipient_email: user.email,
            variables: {
              giver_name: user.user_metadata?.full_name || user.user_metadata?.username || "Generous Giver",
              gift_title: form.title.trim(),
              manage_url: `${window.location.origin}/giving/my-gifts/${data.id}`,
            },
          }).catch(() => {});
        }
        toast.success("Your Christmas Gift is now published! 🎁");
        navigate({ to: "/giving/$id", params: { id: data.id } });
      } else {
        toast.success("Draft saved successfully.");
        navigate({ to: "/giving/my-gifts" });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save gift");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-0 bg-background">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <BackButton fallback="/giving" />

        <div className="mt-4 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>100% Free Christmas Giving</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Give a Gift
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Publish an item you would like to give away freely. All gifts are zero-price and open to genuine applications.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave("published");
          }}
          className="space-y-6"
        >
          {/* TITLE */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Gift Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Warm Winter Puffer Jacket / Children's Learning Tablet"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-secondary/30 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* PHOTOS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Photographs <span className="text-destructive">*</span>
            </label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Upload clear photos showing the front, back and condition. The first picture will be the cover.
            </p>
            {user ? (
              <ImageUploader userId={user.id} value={images} onChange={setImages} />
            ) : (
              <div className="p-6 border border-dashed rounded-xl text-center text-xs text-muted-foreground">
                Please log in to upload photos.
              </div>
            )}
          </div>

          {/* CATEGORY & CONDITION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-secondary/30 border border-border text-sm focus:outline-none focus:border-emerald-600"
              >
                {GIFT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Condition <span className="text-destructive">*</span>
              </label>
              <select
                value={form.condition}
                onChange={(e) => setField("condition", e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-secondary/30 border border-border text-sm focus:outline-none focus:border-emerald-600"
              >
                {GIFT_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* BRAND, SIZE, COLOR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Brand (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Zara, Apple, Lego"
                value={form.brand}
                onChange={(e) => setField("brand", e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Size (Optional)</label>
              <input
                type="text"
                placeholder="e.g. M / 42 / 6-9 months"
                value={form.size}
                onChange={(e) => setField("size", e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Color (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Navy Blue"
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* SPECIFICATIONS */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Specifications / Technical Details (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 64GB storage, battery healthy, includes charging cable"
              value={form.specifications}
              onChange={(e) => setField("specifications", e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* INTENDED BENEFICIARY GUIDANCE */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Who would benefit most from this gift? (Optional guidance)
            </label>
            <input
              type="text"
              placeholder="e.g. Ideal for a student starting university, or a parent needing baby clothes"
              value={form.intended_beneficiary_description}
              onChange={(e) => setField("intended_beneficiary_description", e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
            />
            <p className="text-[11px] text-muted-foreground">
              Helps applicants understand if this gift matches their family's or friend's needs.
            </p>
          </div>

          {/* LOCATION & DEADLINE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Collection City or Area <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ikeja, Lagos or Wuse 2, Abuja"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
              />
              <p className="text-[10px] text-muted-foreground">
                Only the city/neighborhood is public. Specific handover addresses remain confidential until recipient selection.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Application Closing Date (Optional)
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setField("deadline", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full h-11 px-3.5 rounded-xl bg-secondary/30 border border-border text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
            <textarea
              rows={4}
              placeholder="Describe the item, why you are gifting it, and any special notes for the recipient..."
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="w-full p-3.5 rounded-xl bg-secondary/30 border border-border text-xs resize-none placeholder:text-muted-foreground focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:flex-1 h-13 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-base shadow-lg transition-transform active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Publishing Gift...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Publish Christmas Gift
                </>
              )}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave("draft")}
              className="w-full sm:w-auto h-13 px-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save as Draft
            </button>
          </div>
        </form>
      </main>

      <div className="hidden sm:block">
        <SiteFooter />
      </div>
      <MobileNav />
    </div>
  );
}
