import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, organizations(name)")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Menu Editor</h1>
        <p className="text-sm text-muted-foreground">
          Manage sections, items, and options for each venue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {venues?.map((venue) => (
          <Link key={venue.id} href={`/app/menu/${venue.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{venue.name}</CardTitle>
                <CardDescription>{venue.organizations?.name}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Click to edit menu
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!venues?.length && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Create a venue first to start editing menus.
          </p>
        </div>
      )}
    </div>
  );
}
