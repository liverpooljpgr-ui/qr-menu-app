import { createHash } from "node:crypto";
import type { Json } from "@/lib/supabase/database.types";

export const ICON_SIZES = [180, 192, 512] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export function logoPathOf(branding: Json | null | undefined): string | null {
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) return null;
  const path = (branding as { logo_path?: unknown }).logo_path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

// Installed apps only refetch an icon when its URL changes, so the URL carries
// a digest of the logo path.
export function venueIconPath(
  slug: string,
  size: IconSize,
  logoPath: string,
  opts: { maskable?: boolean } = {}
): string {
  const v = createHash("sha1").update(logoPath).digest("hex").slice(0, 8);
  const params = new URLSearchParams({ v });
  if (opts.maskable) params.set("maskable", "1");
  return `/m/${slug}/icon/${size}?${params}`;
}
