import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveGuestVenue } from "@/lib/guest-venue";
import { GuestMenu } from "@/components/guest/guest-menu";
import { AutoRefresh } from "@/components/guest/auto-refresh";
import { OfflineNotice } from "@/components/guest/offline-notice";
import { InstallPrompt } from "@/components/install-prompt";
import type { MenuSnapshot } from "@/lib/menu-snapshot";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await resolveGuestVenue(slug);
  if (!venue) return { title: "Menu" };

  return {
    title: `${venue.venue_name} · Menu`,
    manifest: `/m/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: venue.venue_name, statusBarStyle: "default" },
    icons: { apple: "/icons/icon-192.png" },
  };
}

export default async function GuestMenuPage({ params }: { params: Params }) {
  const { slug } = await params;
  const venue = await resolveGuestVenue(slug);
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
    <>
      <AutoRefresh />
      <OfflineNotice savedAt={new Date().toISOString()} />
      <GuestMenu
        venueName={venue.venue_name}
        currency={venue.currency}
        locale={venue.default_locale}
        menus={menus}
      />
      <InstallPrompt appName={venue.venue_name} storageKey={`install-dismissed:${slug}`} />
    </>
  );
}
