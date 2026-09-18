import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveGuestVenue } from "@/lib/guest-venue";
import { GuestMenu } from "@/components/guest/guest-menu";
import { AutoRefresh } from "@/components/guest/auto-refresh";
import { OfflineNotice } from "@/components/guest/offline-notice";
import { InstallPrompt } from "@/components/install-prompt";
import type { MenuSnapshot } from "@/lib/menu-snapshot";
import { logoPathOf, venueIconPath } from "@/lib/venue-icons";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ menu?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await resolveGuestVenue(slug);
  if (!venue) return { title: "Menu" };

  const logoPath = logoPathOf(venue.branding);
  return {
    title: `${venue.venue_name} · Menu`,
    manifest: `/m/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: venue.venue_name, statusBarStyle: "default" },
    icons: { apple: logoPath ? venueIconPath(slug, 180, logoPath) : "/icons/icon-192.png" },
  };
}

export default async function GuestMenuPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { menu: menuFilter } = await searchParams;
  const venue = await resolveGuestVenue(slug);
  if (!venue) notFound();

  const supabase = await createClient();
  const { data: publications } = await supabase
    .from("menu_publications")
    .select("snapshot, published_at")
    .eq("venue_id", venue.venue_id)
    .eq("is_current", true)
    .order("published_at");

  const allMenus = (publications ?? []).map((p) => p.snapshot as unknown as MenuSnapshot);
  if (allMenus.length === 0) notFound();

  // Admin "Guest view" links target one menu; a stale id just shows everything.
  const filtered = menuFilter ? allMenus.filter((m) => m.menu.id === menuFilter) : [];
  const menus = filtered.length > 0 ? filtered : allMenus;

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
