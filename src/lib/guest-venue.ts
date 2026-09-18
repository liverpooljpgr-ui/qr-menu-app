import { createClient } from "@/lib/supabase/server";

// Resolves a public venue slug; null unless the venue has a current publication.
export async function resolveGuestVenue(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_venue_slug", { p_slug: slug });
  return data?.[0] ?? null;
}
