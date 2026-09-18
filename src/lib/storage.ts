// One bucket per asset kind (see supabase/migrations/*_storage_buckets.sql).
// Object names are "{venue_id}/{filename}"; DB columns store that bare path.
export const STORAGE_BUCKETS = {
  "menu-item": "menu-items",
  "venue-logo": "venue-logos",
} as const;

export type AssetKind = keyof typeof STORAGE_BUCKETS;

export const ASSET_RULES: Record<AssetKind, { maxBytes: number; mimeTypes: readonly string[] }> = {
  "menu-item": {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  "venue-logo": {
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  },
};

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && value in STORAGE_BUCKETS;
}

function publicUrl(bucket: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function getPhotoUrl(photoPath: string | null | undefined): string | undefined {
  return publicUrl(STORAGE_BUCKETS["menu-item"], photoPath);
}

export function getLogoUrl(logoPath: string | null | undefined): string | undefined {
  return publicUrl(STORAGE_BUCKETS["venue-logo"], logoPath);
}
