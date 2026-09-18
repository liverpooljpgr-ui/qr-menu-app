# QR Menu PWA — Claude Code Standing Instructions

## Project Context

**Repository:** qr-menu (monorepo root at D:\qr-menu)  
**Primary working directory:** D:\qr-menu  
**Stack:** Next.js 16.3.5 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (Nova preset) + Supabase PostgreSQL + Supabase Storage  
**Status:** Stage 1 complete (auth + RLS isolation). Stage 2 in progress (menu management).

---

## Architecture

### Multi-Tenant RLS Design

- **Pattern:** Denormalized `venue_id` on every child table (menus, menu_sections, menu_items, option_groups, option_choices, brandings, tables, guest_sessions, events).
- **Foreign keys:** Composite (venue_id + id) so every RLS policy is a single indexed membership lookup: `auth.uid() IN (SELECT user_id FROM memberships WHERE organization_id = venues.organization_id)`.
- **Result:** RLS is fast, deterministic, and breach-proof. Cross-tenant reads always return 0 rows; inserts carrying the wrong venue_id are rejected by RLS (code 42501).

### Pricing & Storage

- **Pricing:** Integer minor units (cents) everywhere. Database: `price_minor` (integer). UI: displays formatted decimals; form inputs accept decimals, parsed to minor units before insert.
- **Image storage:** Supabase Storage with path-based RLS (`/organizations/{orgId}/venues/{venueId}/...`). Uploads via `POST /api/storage/upload` (server-side) to avoid exposing signed URLs in client bundles.

---

## Key Patterns

### Testing

**Test harness:** Vitest 5 with `vitest.config.mts` (ESM, not CommonJS). Runs against the live remote Supabase project; `testTimeout: 30000`.

**Fixtures & helpers:** `tests/helpers.ts`
- `adminClient()` — bypasses RLS (uses SUPABASE_SECRET_KEY); for setup/teardown only.
- `anonClient()` — unprivileged Supabase client.
- `createTestUser(admin, label, runId)` — provisions a confirmed user via auth.admin API (uses secret key); returns client signed in as that user.
- `buildOrgFixture(owner, admin, label, runId)` — creates org + venue + menu + sections + items + option_groups + choices + table + publications + guest events through the owner's client (positive-path check).
- `cleanup(admin, runId, userIds)` — idempotent deletion by runId suffix; even if a test fails midway, all leftovers are removed.

**Isolation test:** `tests/rls-isolation.test.ts` (73 tests, all members-only tables). Re-run on every schema change: `npm run test:isolation`.

### Forms & State

**Pattern (from Stage 1 auth):** `src/components/auth/sign-up-form.tsx`
- Client component with `useState` for form state.
- Supabase client mutations via `createClient()` from `src/lib/supabase/client.ts` (publishable key).
- Error handling: catch + display in UI; no unhandled rejections.
- Submit button disabled during submission.

### UI Components

**shadcn components used:** button, card, input, label, form (from @hookform/react + zod for complex forms).

### Authentication & Session

- **Session refresh:** `src/lib/supabase/session.ts` (updateSession function using @supabase/ssr cookie pattern).
- **Route guards:** `src/proxy.ts` (Next 16 proxy, not deprecated middleware) redirects unauthenticated users to `/auth/login` for `/app/**` routes.
- **Protected shell:** `src/app/app/layout.tsx` server-side check: `getClaims()` or redirect to login.

### Guest View

**Route:** `/m/[slug]` (public, no auth). Server component: `resolve_venue_slug` RPC → current `menu_publications` for the venue → `src/components/guest/guest-menu.tsx`. Renders snapshots only, never live tables, so guests see the last published version until Republish. 404s when nothing is published. Snapshot shape: `src/lib/menu-snapshot.ts`.

**Installable per venue:** `/m/[slug]/manifest.webmanifest` (route handler) gives each venue its own PWA identity (`id`/`start_url`/`scope` = `/m/{slug}`), so "Bistro" and "Cafe" install side by side. The root `manifest.ts` is the admin app's identity and applies to `/app`. `InstallPrompt` with `appName` renders the branded guest prompt; without it, it's the admin prompt and hides on `/m/`.

**Per-venue icons:** `brandings.logo_path` (same bucket/path format as `photo_path`; set via "Set logo" on the menus page) is rendered by `/m/[slug]/icon/[size]` (180/192/512, `?maskable=1` for a wider margin) using `sharp` into a square opaque PNG. URLs carry `?v=<sha1(logo_path)>` because installed apps only refetch an icon when its URL changes. No logo → manifest falls back to `/icons/icon-*.png` and the icon route 404s.

**Freshness / offline:** `AutoRefresh` calls `router.refresh()` on visibility/online/60s. SW is network-first for `/m/**` documents and cache-first for Supabase Storage photos. When the SW serves a navigation from cache it records the client id; `OfflineNotice` asks it on mount and shows "last saved version from {time}", clearing itself when a fresh render changes `savedAt`. Test this with a production build (`next-prod` launch config, port 3001) — the SW does not register in dev.

### Service Worker

**File:** `public/sw.js` (v2)  
**Strategy:**
- Network-first for authenticated routes (`/app`, `/auth`, `/api`) — no caching to prevent stale mutations.
- Cache-first for static assets (`/_next/static/`, `/icons/`, `.woff2`, `.png`, etc.).
- Skips Next.js RSC fetches (`_rsc` param or `RSC: 1` header).

### Password Rules

**File:** `src/lib/password.ts`  
**Rules:** 9+ chars, 1 uppercase, 1 number, 1 special char. Used in sign-up form + validation display.

**UI Component:** `src/components/auth/password-input.tsx` (show/hide toggle via lucide-react Eye/EyeOff icons).

---

## Libraries (Installed)

- `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` — drag-and-drop (Stage 2+).
- `browser-image-compression@2.0.2` — client-side image compression (2MB+ → 400KB target, Stage 2+).
- `@hookform/react` + `zod` — form validation.
- `lucide-react` — icons.
- `sharp@0.35` — server-side rendering of venue logos into PWA launcher icons.

---

## Database Schema (Key Tables)

- **organizations:** id, name, slug, created_at, updated_at.
- **venues:** id, organization_id, name, slug, currency, timezone, default_locale, supported_locales, address (nullable), created_at, updated_at. Edited on the Venue tab of `/app/venues/[venueId]/menus`.
- **brandings:** id, venue_id (unique → one-to-one, embed as `brandings(logo_path)`), theme_key, palette, logo_path.
- **menus:** id, venue_id, name, status ("draft" | "published"), created_at, updated_at.
- **menu_sections:** id, menu_id, venue_id, name, position (integer), is_active (boolean), parent_section_id (nullable, composite FK to menu_sections), created_at, updated_at.
  - **One level of nesting.** A top-level section may hold subsections, each with its own items, alongside the parent's own items. Depth > 1 and cross-menu parents are rejected by trigger `menu_sections_enforce_depth` (errcode 23514). `position` is per sibling group. Snapshot: `sections[].subsections[].items`, built via `private.section_items_snapshot(section_id)`. A hidden parent hides its subsections.
- **menu_items:** id, section_id, venue_id, name, price_minor (integer), description (nullable), photo_path (nullable), is_available (boolean), is_active (boolean), created_at, updated_at.
  - `is_active = false` → excluded from `publish_menu` snapshots entirely (hidden from guests, still editable). `is_available = false` → still published, shown as sold out. Test: `tests/publish-visibility.test.ts`.
- **option_groups:** id, menu_item_id, venue_id, name, position (integer), selection_type, created_at, updated_at.
- **option_choices:** id, option_group_id, venue_id, name, price_delta_minor (integer), position (integer), created_at, updated_at.
- **menu_publications:** id, menu_id, venue_id, version, is_current (boolean), snapshot (JSONB), published_at, published_by.
  - **One published menu per venue.** `publish_menu` retires any other current publication in the venue and sets that menu back to draft, atomically. Enforced by partial unique index `menu_publications_one_current_per_venue (venue_id) where is_current`. The menus page shows a confirm dialog before replacing a live menu.

---

## Environment Variables

**Never commit `.env.local`** — it's in `.gitignore`.

- `NEXT_PUBLIC_SUPABASE_URL` — published, safe for browser.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — published, safe for browser.
- `SUPABASE_SECRET_KEY` — **test-only**; never used in app code. Added to `.env.local` by you from dashboard → Project Settings → API Keys. Used only by `tests/helpers.ts` to provision test users.

---

## Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for prod
npm run test             # Run all Vitest suites
npm run test:isolation   # Run RLS isolation test only
npm run test:supabase    # Run basic Supabase connectivity test
npm run lint             # ESLint + TypeScript check
```

---

## Notes for Future Chats

1. **Stage 1 is complete.** Auth foundation + RLS isolation test suite all green. Before touching auth, re-run `npm run test:isolation` to baseline.
2. **Stage 2 planned:** Menu CRUD + drag-and-drop + image upload. NO AI yet (deferred to post-MVP).
3. **Reorder UX:** Optimistic (drag shows immediately; rolls back on fail).
4. **Image compression:** 2MB+ → 400KB using `browser-image-compression`.
5. **Minor-unit pricing:** All prices are integers (cents, not dollars).
6. **If tests fail with "SUPABASE_SECRET_KEY missing":** Add the secret key from dashboard to `.env.local`. The test will skip if absent (CI-safe).
