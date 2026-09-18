import type { MetadataRoute } from "next";
import { NextResponse } from "next/server";
import { resolveGuestVenue } from "@/lib/guest-venue";
import { logoPathOf, venueIconPath } from "@/lib/venue-icons";

const DEFAULT_ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
];

function venueIcons(slug: string, logoPath: string): MetadataRoute.Manifest["icons"] {
  return [
    { src: venueIconPath(slug, 192, logoPath), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: venueIconPath(slug, 512, logoPath), sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: venueIconPath(slug, 512, logoPath, { maskable: true }),
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];
}

// One installable app per venue: id/start_url/scope are all venue-specific so
// "Bistro" and "Cafe" install side by side and reopen to their own menu.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const venue = await resolveGuestVenue(slug);
  if (!venue) return new NextResponse(null, { status: 404 });

  const path = `/m/${slug}`;
  const logoPath = logoPathOf(venue.branding);
  const manifest: MetadataRoute.Manifest = {
    id: path,
    name: venue.venue_name,
    short_name: venue.venue_name,
    start_url: path,
    scope: path,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: logoPath ? venueIcons(slug, logoPath) : DEFAULT_ICONS,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
