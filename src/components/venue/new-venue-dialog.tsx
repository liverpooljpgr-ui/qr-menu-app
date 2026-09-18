"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { intlValues, slugify, SLUG_RE } from "@/lib/intl-options";
import { selectClass } from "@/components/venue/venue-settings-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface NewVenueDialogProps {
  organizations: { id: string; name: string }[];
  defaultCurrency: string;
}

export function NewVenueDialog({ organizations, defaultCurrency }: NewVenueDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = useMemo(() => intlValues("currency", defaultCurrency), [defaultCurrency]);
  const timezones = useMemo(() => intlValues("timeZone", timezone), [timezone]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const reset = () => {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setAddress("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Venue name is required.");
    if (!SLUG_RE.test(slug)) {
      return setError("Slug must be lowercase letters, numbers, and single hyphens.");
    }
    if (!organizationId) return setError("Choose an organization.");

    setIsSaving(true);
    const { data, error } = await supabase
      .from("venues")
      .insert({
        organization_id: organizationId,
        name: trimmedName,
        slug,
        currency,
        timezone,
        address: address.trim() || null,
      })
      .select("id")
      .single();
    setIsSaving(false);

    if (error || !data) {
      setError(
        error?.code === "23505"
          ? "That slug is already taken by another venue."
          : (error?.message ?? "Failed to create venue")
      );
      return;
    }

    setOpen(false);
    reset();
    router.push(`/app/venues/${data.id}/menus`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New venue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New venue</DialogTitle>
            <DialogDescription>
              Each venue gets its own guest menu link and QR code.
            </DialogDescription>
          </DialogHeader>

          {organizations.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="new-venue-org">Organization</Label>
              <select
                id="new-venue-org"
                className={selectClass}
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                disabled={isSaving}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-venue-name">Name</Label>
            <Input
              id="new-venue-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Harbour Cafe"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-venue-slug">Slug</Label>
            <Input
              id="new-venue-slug"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              disabled={isSaving}
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Guest URL: <span className="font-mono">/m/{slug || "…"}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-venue-address">Address</Label>
            <Input
              id="new-venue-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Optional"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-venue-currency">Currency</Label>
              <select
                id="new-venue-currency"
                className={selectClass}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isSaving}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-timezone">Timezone</Label>
              <select
                id="new-venue-timezone"
                className={selectClass}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={isSaving}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
