import { NextResponse } from "next/server";
import sharp from "sharp";
import { resolveGuestVenue } from "@/lib/guest-venue";
import { getLogoUrl } from "@/lib/storage";
import { ICON_SIZES, logoPathOf, type IconSize } from "@/lib/venue-icons";

const BACKGROUND = "#ffffff";

// Renders the venue logo as a square, opaque PNG launcher icon. Maskable icons
// get a wider margin so circle/squircle masks don't clip the logo.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; size: string }> }
) {
  const { slug, size: rawSize } = await params;
  const size = Number(rawSize) as IconSize;
  if (!ICON_SIZES.includes(size)) {
    return new NextResponse(null, { status: 404 });
  }

  const venue = await resolveGuestVenue(slug);
  const logoPath = logoPathOf(venue?.branding);
  if (!logoPath) return new NextResponse(null, { status: 404 });

  const maskable = new URL(request.url).searchParams.get("maskable") === "1";

  const logoRes = await fetch(getLogoUrl(logoPath)!);
  if (!logoRes.ok) return new NextResponse(null, { status: 502 });

  const inner = Math.round(size * (maskable ? 0.66 : 0.86));
  const before = Math.floor((size - inner) / 2);
  const after = size - inner - before;

  try {
    const png = await sharp(Buffer.from(await logoRes.arrayBuffer()))
      .resize(inner, inner, { fit: "contain", background: BACKGROUND })
      .flatten({ background: BACKGROUND })
      .extend({ top: before, left: before, bottom: after, right: after, background: BACKGROUND })
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (error) {
    console.error("Icon render failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
