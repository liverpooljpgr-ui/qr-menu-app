import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GuestMenu } from "@/components/guest/guest-menu";
import type { MenuSnapshot } from "@/lib/menu-snapshot";

type Params = Promise<{ slug: string }>;

async function loadVenue(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_venue_slug", { p_slug: slug });
  return data?.[0] ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await loadVenue(slug);
  return { title: venue ? `${venue.venue_name} · Menu` : "Menu" };
}

export default async function GuestMenuPage({ params }: { params: Params }) {
  const { slug } = await params;
  const venue = await loadVenue(slug);
  if (!venue) notFound();

  const supabase = await createClient();
  const { data: publications } = await supabase
    .from("menu_publications")
    .select("snapshot, published_at")
    .eq("venue_id", venue.venue_id)
    .eq("is_current", true)
    .order("published_at");

  const menus = (publications ?? []).map((p) => p.snapshot as unknown as MenuSnapshot);
  if (menus.length === 0) notFound();

  return (
    <GuestMenu
      venueName={venue.venue_name}
      currency={venue.currency}
      locale={venue.default_locale}
      menus={menus}
    />
  );
}
