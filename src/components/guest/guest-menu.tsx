import { Badge } from "@/components/ui/badge";
import { formatPrice, formatPriceDelta } from "@/lib/money";
import { getPhotoUrl } from "@/lib/storage";
import type { MenuSnapshot, SnapshotItem, SnapshotSection } from "@/lib/menu-snapshot";

interface GuestMenuProps {
  venueName: string;
  currency: string;
  locale: string;
  menus: MenuSnapshot[];
}

function sectionAnchor(section: SnapshotSection) {
  return `s-${section.id}`;
}

function ItemRow({
  item,
  currency,
  locale,
}: {
  item: SnapshotItem;
  currency: string;
  locale: string;
}) {
  const photoUrl = getPhotoUrl(item.photo_path);

  return (
    <li className={`flex gap-4 py-4 ${item.is_available ? "" : "opacity-60"}`}>
      {photoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-muted"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium leading-snug">{item.name}</h3>
          <span className="font-semibold whitespace-nowrap">
            {formatPrice(item.price_minor, currency, locale)}
          </span>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
        )}
        {(!item.is_available || item.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {!item.is_available && <Badge variant="secondary">Sold out</Badge>}
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {item.option_groups.map((group) => (
          <p key={group.id} className="text-xs text-muted-foreground mt-2">
            <span className="font-medium text-foreground">{group.name}:</span>{" "}
            {group.choices
              .map((c) =>
                c.price_delta_minor === 0
                  ? c.name
                  : `${c.name} ${formatPriceDelta(c.price_delta_minor, currency, locale)}`
              )
              .join(" · ")}
          </p>
        ))}
      </div>
    </li>
  );
}

export function GuestMenu({ venueName, currency, locale, menus }: GuestMenuProps) {
  const allSections = menus.flatMap((m) => m.sections);
  const showMenuNames = menus.length > 1;

  return (
    <div className="min-h-full bg-background">
      <header className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-semibold">{venueName}</h1>
      </header>

      {allSections.length > 1 && (
        <nav className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <ul className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
            {allSections.map((section) => (
              <li key={section.id} className="flex-shrink-0">
                <a
                  href={`#${sectionAnchor(section)}`}
                  className="inline-block rounded-full border px-3 py-1 text-sm hover:bg-muted"
                >
                  {section.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="px-4 pb-16">
        {menus.map((snapshot) => (
          <div key={snapshot.menu.id}>
            {showMenuNames && (
              <h2 className="text-lg font-semibold mt-8 mb-2 text-muted-foreground">
                {snapshot.menu.name}
              </h2>
            )}
            {snapshot.sections.map((section) => (
              <section
                key={section.id}
                id={sectionAnchor(section)}
                className="pt-6 scroll-mt-14"
              >
                <h2 className="text-xl font-semibold mb-1">{section.name}</h2>
                <ul className="divide-y">
                  {section.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      currency={currency}
                      locale={locale}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
