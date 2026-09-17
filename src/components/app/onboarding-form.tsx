"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";

const CURRENCIES = ["USD", "EUR", "GBP", "UAH", "PLN", "CHF", "CAD", "AUD"];

export function OnboardingForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueSlug, setVenueSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleVenueName(value: string) {
    setVenueName(value);
    if (!slugTouched) setVenueSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const orgSlug = slugify(orgName) || venueSlug;

    const { data: org, error: orgError } = await supabase.rpc("create_organization", {
      p_name: orgName.trim() || venueName.trim(),
      p_slug: orgSlug,
    });
    if (orgError || !org) {
      setError(friendly(orgError?.message, "organization"));
      setIsLoading(false);
      return;
    }

    const { error: venueError } = await supabase
      .from("venues")
      .insert({ organization_id: org.id, name: venueName.trim(), slug: venueSlug, currency });
    if (venueError) {
      setError(friendly(venueError.message, "venue"));
      setIsLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set up your restaurant</CardTitle>
          <CardDescription>
            An organization groups your venues; most restaurants start with one of each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Business name</Label>
              <Input
                id="org-name"
                required
                placeholder="Acme Hospitality"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="venue-name">Venue name</Label>
              <Input
                id="venue-name"
                required
                placeholder="Acme Bistro"
                value={venueName}
                onChange={(e) => handleVenueName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="venue-slug">Menu URL</Label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">/v/</span>
                <Input
                  id="venue-slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Lowercase letters, numbers, and single hyphens"
                  value={venueSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setVenueSlug(slugify(e.target.value));
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create venue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function friendly(message: string | undefined, what: "organization" | "venue") {
  if (message?.includes("duplicate key")) {
    return `That ${what} URL is already taken — try a different one.`;
  }
  return message ?? `Could not create ${what}.`;
}
