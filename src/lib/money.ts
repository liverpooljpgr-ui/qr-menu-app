export function formatPrice(minor: number, currency: string, locale = "en"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function formatPriceDelta(minor: number, currency: string, locale = "en"): string {
  const abs = formatPrice(Math.abs(minor), currency, locale);
  return minor < 0 ? `−${abs}` : `+${abs}`;
}
