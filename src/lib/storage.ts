const PUBLIC_BUCKET_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-items`;

// photo_path is stored as a bucket-relative path; older rows may hold a full URL.
export function getPhotoUrl(photoPath: string | null | undefined): string | undefined {
  if (!photoPath) return undefined;
  if (/^https?:\/\//.test(photoPath)) return photoPath;
  return `${PUBLIC_BUCKET_URL}/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
}
