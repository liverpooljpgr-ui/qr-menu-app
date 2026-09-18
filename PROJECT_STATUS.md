# QR Menu PWA — Project Status

**Last updated:** 2026-09-18  
**User email:** liverpool.jpgr@gmail.com

---

## Completion Status

### ✅ Stage 1: Auth Foundation + RLS Isolation Test Suite

**Status:** COMPLETE  
**Tests passing:** 73/73 (RLS isolation matrix across all members-only tables)  
**Last commit:** `62bc69e — Add auth foundation and standing RLS isolation test suite`

#### What's Done

1. **Supabase multi-tenant RLS** — denormalized `venue_id` on all child tables; every RLS policy is a single indexed membership lookup.
2. **Auth foundation** — sign-up, login, email verification (required before login), OAuth redirect flow.
3. **Protected shell** — `/app/**` requires authentication; unauthenticated users redirected to `/auth/login`.
4. **Onboarding flow** — users who sign up are directed to create an org + venue before accessing the app.
5. **Isolation test suite** — standing test per table verifies cross-tenant breach attempts fail:
   - A cannot read/update/delete B's data.
   - A cannot insert rows carrying B's organization_id or venue_id.
   - A cannot publish/unpublish B's menus.
   - Staff cannot promote themselves or delete owners.
6. **Node 22 LTS** — native WebSocket; `ws` devDependency removed; tests run reliably.
7. **Vitest 5** — `vitest.config.mts` (ESM); `tests/helpers.ts` with fixture builders and cleanup.
8. **Password validation** — 9+ chars, uppercase, number, special; displayed in sign-up form.
9. **Service worker v2** — network-first for `/app`, `/auth`, `/api`; cache-first for static assets.

#### Files Created

- `src/lib/supabase/client.ts` — browser Supabase client (publishable key).
- `src/lib/supabase/server.ts` — server Supabase client (cookie-based session).
- `src/lib/supabase/session.ts` — session refresh via @supabase/ssr.
- `src/lib/password.ts` — password rules (exported for form validation + display).
- `src/components/auth/password-input.tsx` — password field with show/hide toggle.
- `src/components/auth/sign-up-form.tsx` — sign-up form (name, email, password, phone, display name).
- `src/components/auth/login-form.tsx` — login form (email, password).
- `src/app/auth/sign-up/page.tsx` — sign-up page.
- `src/app/auth/login/page.tsx` — login page.
- `src/app/auth/sign-up-success/page.tsx` — "check your inbox" confirmation page.
- `src/app/auth/error/page.tsx` — OAuth error handler.
- `src/app/auth/callback/route.ts` — OAuth + email confirmation callback.
- `src/app/auth/confirm/route.ts` — custom email template OTP verification.
- `src/proxy.ts` — Next 16 route guard (redirects `/app/**` unauthenticated to login).
- `src/app/app/layout.tsx` — protected admin shell; server-side getClaims() check.
- `src/app/app/page.tsx` — onboarding form or venue list (depending on membership status).
- `vitest.config.mts` — test runner config.
- `tests/setup.ts` — test setup file (loads .env.local).
- `tests/rls-isolation.test.ts` — 73-test suite verifying cross-tenant isolation.
- `tests/helpers.ts` — test utilities (adminClient, createTestUser, buildOrgFixture, cleanup).

---

### ✅ Stage 2: Menu Management (COMPLETE)

**Status:** IMPLEMENTATION COMPLETE; TESTED  
**Last commit:** Menu management UI with drag-and-drop and image upload  
**Tests:** All 73 RLS isolation tests passing

#### What's Built

1. **Menu editor UI** — venue selector (`/app/menu`) → per-venue editor (`/app/menu/[venueId]`).
2. **CRUD forms** — create/edit sections and items with real-time form validation.
3. **Drag-and-drop reordering** — using `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0`.
   - Optimistic UI: drag shows immediately; rolls back on save fail.
   - Atomic position updates via `POST /api/menu/reorder`.
4. **Image upload** — file input with drag-and-drop, client-side compression (2MB+ → 400KB), server-side upload to Supabase Storage.
   - Compression via `browser-image-compression@2.0.2` with WebWorker support.
   - Upload handler at `POST /api/storage/upload` (avoids exposing signed URLs).
5. **Option groups (read-only)** — structure ready; CRUD TBD in next stage if needed.
6. **Publish/unpublish** — RPC infrastructure already exists in schema.

#### User Design Decisions (Implemented)

- **Reorder UX:** Optimistic — drag shows immediately; rolls back if save fails. ✅
- **Image compression:** Triggered on 2MB+; targets 400KB post-compression. ✅
- **AI descriptions:** Deferred to post-MVP. Menu uses user-entered text for now; AI integration to follow.

#### Files Created (Stage 2) ✅

**UI Components:**
- `src/app/app/menu/page.tsx` — venue selector listing all venues. ✅
- `src/app/app/menu/[venueId]/page.tsx` — menu editor with sections/items panels. ✅
- `src/components/menu/menu-sections.tsx` — sections list + drag-and-drop reordering. ✅
- `src/components/menu/menu-items.tsx` — items list + drag-and-drop + photo preview. ✅
- `src/components/menu/section-form.tsx` — create/edit sections form. ✅
- `src/components/menu/item-form.tsx` — create/edit items form (name, description, price, photo). ✅
- `src/components/ui/file-input.tsx` — file chooser with drag-and-drop + validation. ✅

**Utilities:**
- `src/lib/image-compression.ts` — client-side compression (2MB+ → 400KB). ✅

**API Routes:**
- `src/app/api/storage/upload/route.ts` — server-side image upload to Supabase Storage. ✅
- `src/app/api/menu/reorder/route.ts` — atomic position updates for reordering. ✅

#### Database Tables Used

Already exist (created in Stage 1):
- `menus`, `menu_sections`, `menu_items`, `option_groups`, `option_choices` (all with `venue_id` denormalization).
- `menu_publications` (append-only snapshots).

No schema changes needed; RLS policies already allow owner/manager to edit.

---

## Known Constraints & Decisions

1. **Pricing is integer minor units.** All prices stored as cents (or the currency's smallest unit). UI displays formatted decimals; forms accept decimals and parse to minor units before insert.

2. **Every child table has venue_id.** This denormalization enables RLS policies to be single indexed membership lookups (fast + breach-proof).

3. **Email verification is blocking.** Supabase's built-in auth requires email confirmation before login. Publishing gates on `email_confirmed_at` RPC checks (not a separate verification flow).

4. **Service worker skips /app, /auth, /api.** These routes are network-first only; no caching to prevent stale mutations after save.

5. **Tests require SUPABASE_SECRET_KEY.** Add this to `.env.local` from dashboard → Project Settings → API Keys. If missing, tests skip gracefully (CI-safe).

6. **No AI yet.** Stage 2 builds menu CRUD + drag-and-drop + image upload without Claude API. Descriptions will be user-entered in the form. AI generation to be added later.

---

## Next Steps (Stage 3: Option Groups + Publish)

1. **Option groups CRUD** — extend ItemForm with nested option-group/choice management.
2. **Publish menu** — add publish button to menu editor → RPC call → append snapshot to `menu_publications`.
3. **Public menu view** — read-only guest page (`/menu/{venueSlug}`) showing published menu.
4. **Menu preview** — toggle between editor + preview modes in `/app/menu/[venueId]`.
5. **AI descriptions** — integrate Claude API for auto-generating item descriptions (post-MVP).
6. **Testing:** Verify end-to-end workflow: create → edit → upload → reorder → publish → view as guest.

---

## Testing

### Run Tests

```bash
npm run test:isolation    # Full 73-test RLS suite
npm run test:supabase     # Basic connectivity check
npm run test              # All Vitest suites
```

### Verification Workflow (After Stage 2 Implementation)

- Venues list from Stage 1 works → click into venue → sections/items list appears.
- Create section/item forms work.
- Drag-and-drop reorder works (optimistic + rollback on network failure).
- Image upload: choose file → compress if needed → upload → photo_path saved in database.
- `npm run test:isolation`: Still 73/73; RLS blocks cross-tenant access to all menu tables.
- Prod deploy: Menu editor only for members; anon sees nothing.

---

## Dashboard Configuration (Supabase)

**Required (one-time setup):**

1. **API Keys:** Copy SUPABASE_SECRET_KEY from Project Settings → API Keys into `.env.local`.
2. **URL Configuration:** 
   - Site URL: `https://qr-menu-app-sooty.vercel.app`
   - Redirect URLs: `http://localhost:3000/**` and `https://qr-menu-app-sooty.vercel.app/**`
3. **(Optional) Google OAuth:** If you want "Continue with Google" button, add Google Cloud OAuth credentials in Authentication → Providers → Google.

---

## Deployments

**Production:** qr-menu-app-sooty.vercel.app (Vercel, auto-deploys from master branch).

---

## Notes

- **This file is a snapshot.** It reflects the state as of the last update. Before starting a new phase, re-run tests to confirm no regressions.
- **CLAUDE.md** contains standing instructions (patterns, libraries, conventions) that are stable across stages.
- **Future chats** should read both CLAUDE.md (architecture/patterns) and PROJECT_STATUS.md (current work) before proceeding.
