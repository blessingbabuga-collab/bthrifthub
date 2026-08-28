import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ModerationResult = {
  approved: boolean;
  reasons: string[];
  categories?: {
    nsfw?: boolean;
    violence?: boolean;
    hate?: boolean;
    illegal?: boolean;
    watermark_or_stock?: boolean;
    low_quality?: boolean;
    not_a_product?: boolean;
  };
};

const SYSTEM_PROMPT = `You are a strict image moderator for a Nigerian thrift-clothing marketplace.
Given ONE product photo, decide if it is safe and high-quality enough to publish.

REJECT if the image contains any of:
- Nudity, sexual content, or suggestive/underwear-only shots
- Violence, gore, weapons
- Hate symbols or illegal items (drugs, counterfeits, ivory)
- Screenshots, memes, or heavy watermarks/stock-photo overlays
- Blank/black/white/solid-color images with no product
- Extremely blurry, dark, or unrecognisable photos
- No visible clothing/thrift product at all (e.g. selfies, food, random scenery)

APPROVE otherwise — imperfect lighting is fine, mannequins and flat-lays are fine.

Return ONLY compact JSON matching:
{"approved":boolean,"reasons":string[],"categories":{"nsfw":boolean,"violence":boolean,"hate":boolean,"illegal":boolean,"watermark_or_stock":boolean,"low_quality":boolean,"not_a_product":boolean}}
Reasons must be short, buyer-friendly (e.g. "Image is too blurry").`;

async function callGateway(imageUrl: string, apiKey: string): Promise<ModerationResult> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Moderate this product photo." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Moderation is busy, try again in a moment.");
    if (res.status === 402) throw new Error("Moderation credits exhausted. Contact support.");
    console.error("[moderate-image] gateway error", res.status, body);
    throw new Error(`Image moderation failed (${res.status})`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  let parsed: ModerationResult;
  try {
    parsed = JSON.parse(text) as ModerationResult;
  } catch {
    console.error("[moderate-image] non-JSON response", text);
    // Fail closed on unparseable output.
    return { approved: false, reasons: ["Could not verify image. Please try another photo."] };
  }

  return {
    approved: Boolean(parsed.approved),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5).map(String) : [],
    categories: parsed.categories,
  };
}

export const moderateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { imageUrl: string }) => {
    if (!input || typeof input.imageUrl !== "string") throw new Error("imageUrl required");
    if (!/^https?:\/\//.test(input.imageUrl)) throw new Error("imageUrl must be a URL");
    if (input.imageUrl.length > 2048) throw new Error("imageUrl too long");
    return { imageUrl: input.imageUrl };
  })
  .handler(async ({ data }): Promise<ModerationResult> => {
    // Lovable AI has been disconnected per user request.
    // Bypassing image moderation for now. Can be wired to OpenAI/Gemini later.
    return { approved: true, reasons: [] };
  });