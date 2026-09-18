import { createClient } from "@/lib/supabase/server";
import { getPhotoUrl } from "@/lib/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewVenueDialog } from "@/components/venue/new-venue-dialog";
import Link from "next/link";
import { MapPin, Store } from "lucide-react";

export default async function VenuesPage() {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id");

  if (!memberships?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No organizations found.</p>
      </div>
    );
  }

  const [{ data: venues }, { data: organizations }] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, slug, currency, address, organizations(name), brandings(logo_path)")
      .order("created_at"),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  const newVenue = (
    <NewVenueDialog
      organizations={organizations ?? []}
      defaultCurrency={venues?.[0]?.currency ?? "USD"}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your Venues</h1>
          <p className="text-sm text-muted-foreground">
            Manage menus and content for each venue
          </p>
        </div>
        {newVenue}
      </div>

      {!venues?.length ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">
            Create a venue first to start managing menus.
          </p>
          <div className="flex justify-center">{newVenue}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => {
            const logoUrl = getPhotoUrl(venue.brandings?.logo_path);
            return (
              <Link key={venue.id} href={`/app/venues/${venue.id}/menus`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <div className="w-14 h-14 rounded-lg border bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                      {logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Store className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{venue.name}</CardTitle>
                      <CardDescription>
                        {venue.organizations?.name} · {venue.currency}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {venue.address ? (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{venue.address}</span>
                      </p>
                    ) : (
                      <p className="italic">No address yet</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
