import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Camera, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { moderateImage } from "@/lib/moderate-image.functions";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year
const MAX_IMAGES = 8;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_BYTES = 15 * 1024; // 15KB — reject near-empty/solid-color shots
const MIN_DIMENSION = 400; // px on the shortest side

export type UploadedImage = { url: string; path: string };

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadOne(file: File, userId: string): Promise<UploadedImage> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 8MB`);
  if (file.size < MIN_BYTES) throw new Error(`${file.name} looks empty or too low-quality`);
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
  try {
    const { width, height } = await readImageDimensions(file);
    if (Math.min(width, height) < MIN_DIMENSION) {
      throw new Error(`${file.name} is too small (min ${MIN_DIMENSION}px)`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("too small")) throw e;
    throw new Error(`${file.name} could not be read`);
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (sErr || !data) throw sErr ?? new Error("Could not sign URL");
  return { url: data.signedUrl, path };
}

export function ImageUploader({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const moderate = useServerFn(moderateImage);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - value.length;
    if (room <= 0) { toast.error(`Max ${MAX_IMAGES} images`); return; }
    const list = Array.from(files).slice(0, room);
    setBusy(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const f of list) {
        let img: UploadedImage | null = null;
        try {
          img = await uploadOne(f, userId);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
          continue;
        }
        // Content moderation — reject and clean up if the image is unsafe / low quality.
        try {
          const result = await moderate({ data: { imageUrl: img.url } });
          if (!result.approved) {
            const reason = result.reasons?.[0] ?? "Image did not pass moderation";
            toast.error(`${f.name}: ${reason}`);
            void supabase.storage.from("product-images").remove([img.path]);
            continue;
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not verify image");
          void supabase.storage.from("product-images").remove([img.path]);
          continue;
        }
        uploaded.push(img);
      }
      if (uploaded.length) onChange([...value, ...uploaded]);
    } finally { setBusy(false); }
  };

  const remove = async (i: number) => {
    const img = value[i];
    onChange(value.filter((_, idx) => idx !== i));
    void supabase.storage.from("product-images").remove([img.path]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {value.map((img, i) => (
            <div key={img.path} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary group">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-amber text-accent-foreground px-1.5 py-0.5 rounded-full font-bold">Cover</span>
              )}
              <button type="button" onClick={() => remove(i)} aria-label="Remove" className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground">
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 right-1 flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left" className="p-1 rounded-full bg-background/80 disabled:opacity-40">
                  <ArrowUp className="h-3 w-3 -rotate-90" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move right" className="p-1 rounded-full bg-background/80 disabled:opacity-40">
                  <ArrowDown className="h-3 w-3 -rotate-90" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy || value.length >= MAX_IMAGES} className="h-24 rounded-xl border-2 border-dashed border-border hover:border-amber inline-flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          Gallery / Files
        </button>
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy || value.length >= MAX_IMAGES} className="h-24 rounded-xl border-2 border-dashed border-border hover:border-amber inline-flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground disabled:opacity-50">
          <Camera className="h-5 w-5" />
          Take Photo
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Up to {MAX_IMAGES} photos · 8MB each · first image is the cover · drag arrows to reorder
      </p>
    </div>
  );
}