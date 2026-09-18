import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, currency, organizations(name)")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Your Venues</h1>
        <p className="text-sm text-muted-foreground">
          Manage menus and content for each venue
        </p>
      </div>

      {!venues?.length ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Create a venue first to start managing menus.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Link key={venue.id} href={`/app/venues/${venue.id}/menus`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{venue.name}</CardTitle>
                  <CardDescription>
                    {venue.organizations?.name} · {venue.currency}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Click to manage menus
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
