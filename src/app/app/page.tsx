import { OnboardingForm } from "@/components/app/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();

  // RLS scopes both queries to the user's own organizations.
  const { data: memberships } = await supabase.from("memberships").select("organization_id");
  if (!memberships?.length) {
    return <OnboardingForm />;
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, currency, organizations(name)")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Your venues</h1>
        <p className="text-sm text-muted-foreground">Menus, branding, and tables live under each venue.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {venues?.map((venue) => (
          <Card key={venue.id}>
            <CardHeader>
              <CardTitle>{venue.name}</CardTitle>
              <CardDescription>
                {venue.organizations?.name} · /{venue.slug} · {venue.currency}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Menu editing arrives in the next stage.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
