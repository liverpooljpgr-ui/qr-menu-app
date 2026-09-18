"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSET_RULES, getLogoUrl } from "@/lib/storage";
import { intlValues, SLUG_RE } from "@/lib/intl-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus } from "lucide-react";

export interface VenueSettings {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  default_locale: string;
  address: string | null;
}

interface VenueSettingsFormProps {
  venue: VenueSettings;
  logoPath: string | null;
  onVenueChange: (venue: VenueSettings) => void;
  onLogoChange: (path: string) => void;
}

const LOGO_RULES = ASSET_RULES["venue-logo"];

export const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

export function VenueSettingsForm({
  venue,
  logoPath,
  onVenueChange,
  onLogoChange,
}: VenueSettingsFormProps) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: venue.name,
    slug: venue.slug,
    currency: venue.currency,
    timezone: venue.timezone,
    default_locale: venue.default_locale,
    address: venue.address ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currencies = useMemo(() => intlValues("currency", venue.currency), [venue.currency]);
  const timezones = useMemo(() => intlValues("timeZone", venue.timezone), [venue.timezone]);

  const isDirty =
    form.name !== venue.name ||
    form.slug !== venue.slug ||
    form.currency !== venue.currency ||
    form.timezone !== venue.timezone ||
    form.default_locale !== venue.default_locale ||
    form.address !== (venue.address ?? "");

  const slugChanged = form.slug !== venue.slug;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSavedAt(null);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const slug = form.slug.trim();
    const default_locale = form.default_locale.trim();
    if (!name) return setError("Venue name is required.");
    if (!SLUG_RE.test(slug)) {
      return setError("Slug must be lowercase letters, numbers, and single hyphens.");
    }
    if (!default_locale) return setError("Default locale is required.");

    setIsSaving(true);
    const patch = {
      name,
      slug,
      currency: form.currency,
      timezone: form.timezone,
      default_locale,
      address: form.address.trim() || null,
    };
    const { error } = await supabase.from("venues").update(patch).eq("id", venue.id);
    setIsSaving(false);

    if (error) {
      setError(
        error.code === "23505" ? "That slug is already taken by another venue." : error.message
      );
      return;
    }
    onVenueChange({ id: venue.id, ...patch });
    setForm({ ...patch, address: patch.address ?? "" });
    setSavedAt(Date.now());
  };

  const handleLogoChange = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > LOGO_RULES.maxBytes) {
      setError(`Logo must be ${Math.round(LOGO_RULES.maxBytes / 1024 / 1024)} MB or smaller.`);
      return;
    }

    setIsUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("venueId", venue.id);
      formData.append("kind", "venue-logo");
      const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error || "Logo upload failed");

      const { error } = await supabase
        .from("brandings")
        .upsert({ venue_id: venue.id, logo_path: body.path }, { onConflict: "venue_id" });
      if (error) throw error;

      onLogoChange(body.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save logo");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg border bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
            {logoPath ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={getLogoUrl(logoPath)} alt="" className="w-full h-full object-contain" />
            ) : (
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_RULES.mimeTypes.join(",")}
              className="hidden"
              onChange={(e) => handleLogoChange(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? "Uploading..." : logoPath ? "Change logo" : "Set logo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Used as the app icon when guests add your menu to their home screen.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue-name">Name</Label>
        <Input id="venue-name" value={form.name} onChange={set("name")} disabled={isSaving} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue-slug">Slug</Label>
        <Input
          id="venue-slug"
          value={form.slug}
          onChange={set("slug")}
          disabled={isSaving}
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Guest URL: <span className="font-mono">/m/{form.slug || "…"}</span>
        </p>
        {slugChanged && (
          <p className="text-xs text-amber-700">
            Changing the slug changes the guest URL. QR codes printed with the old address
            will stop working.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue-address">Address</Label>
        <Input
          id="venue-address"
          value={form.address}
          onChange={set("address")}
          disabled={isSaving}
          placeholder="12 Market Street, Springfield"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="venue-currency">Currency</Label>
          <select
            id="venue-currency"
            className={selectClass}
            value={form.currency}
            onChange={set("currency")}
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
          <Label htmlFor="venue-locale">Default locale</Label>
          <Input
            id="venue-locale"
            value={form.default_locale}
            onChange={set("default_locale")}
            disabled={isSaving}
            placeholder="en"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="venue-timezone">Timezone</Label>
        <select
          id="venue-timezone"
          className={selectClass}
          value={form.timezone}
          onChange={set("timezone")}
          disabled={isSaving}
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!isDirty || isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
        {savedAt && !isDirty && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </form>
  );
}
