// Browser-provided currency / timezone lists; `current` is kept even if the
// runtime doesn't know it so an existing value never disappears from a select.
export function intlValues(key: "currency" | "timeZone", current?: string): string[] {
  const values =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf(key) : [];
  if (!current || values.includes(current)) return values;
  return [current, ...values];
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
