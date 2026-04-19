# HANDOFF.md — BackFLO

> Last updated: 2026-04-19. Phase 4 complete.
> Next update: at Phase 5 completion (mobile polish + PWA + local form persistence).

## 1. Project Overview

**BackFLO** is a SaaS for backflow-prevention testers (solo operators and small 1–5-tech shops). Positioned as "the modern alternative to Syncta" at $39/mo flat. Target ARR: 50 customers × $39 ≈ $23K by month 6.

**Core loop:** Arrive → find device → test → PDF certificate → email → next job. Sub-2-minute test recording on a phone is the UX target.

**Stack:**
- Next.js 16.2.4 (App Router, Turbopack) + TypeScript strict mode
- Supabase (Postgres, Auth, Storage; multi-tenant via RLS from day one)
- Tailwind 4 + shadcn/ui (built on **base-ui**, not Radix)
- Zod 4 + react-hook-form + `@hookform/resolvers`
- Sonner for toasts; next-themes feeds sonner's theme
- Vitest for unit tests
- Netlify for hosting (linked to GitHub repo for auto-deploy)
- `@react-pdf/renderer` (certificates), Resend + React Email (transactional email, Phase 4 — live), Stripe (later)

**Key directories:**
- `src/app/` — Next.js App Router pages/layouts
- `src/lib/supabase/` — client/server/middleware wrappers + generated types
- `src/lib/validation/` — Zod schemas and shared field primitives
- `src/lib/auth/` — auth error mapper + safe-next path validator
- `src/lib/db/` — typed DB helpers + generic DB error wrapper
- `src/lib/dates/` — due-status buckets + gauge-notice soft checks (Phase 3)
- `src/components/app/` — shell UI (header, field, back-link, search bar, sign-out, add-device banner)
- `src/components/auth/` — auth-shell card layout
- `src/components/ui/` — shadcn primitives (don't hand-edit; regenerate via `npx shadcn@latest add`)
- `src/lib/pdf/` — certificate data shaper + `@react-pdf/renderer` Certificate component + `renderCertificatePdf` wrapper (Phase 4)
- `src/lib/storage/` — path builders + upload/download helpers for the `certificates` and `company-logos` buckets (Phase 4)
- `src/lib/email/` — recipient resolver, payload builder, Resend client, React Email certificate template (Phase 4)
- `supabase/migrations/` — forward-only SQL migrations

**Reference docs:**
- [`BackFLO_MVP_Blueprint.md`](BackFLO_MVP_Blueprint.md) — product spec, source of truth
- [`CLAUDE.md`](CLAUDE.md) — working-with-the-code conventions
- [`AGENTS.md`](AGENTS.md) — Next.js 16 heads-up (imported by CLAUDE.md)

## 2. Current Status

**Phase 4 (PDF + Email) — complete on `main`. Phase 5 (Polish + PWA) — not started.**

- **GitHub:** https://github.com/j-moreyra/backflo-app (public)
- **Active branch:** `main`
- **Latest commit:** `6a44341 feat(certificate): server actions + certificate page + history links`
- Deployed to Netlify deploy preview. Production Netlify site not yet connected.

**Phase 3 delivery (15 commits, not yet squashed to a PR):**
- **`search_devices_by_serial` RPC** — pg_trgm similarity() over the existing `idx_devices_serial_trgm` GIN index. SECURITY INVOKER; tunable threshold with a 0.3 floor (the `%` operator's default similarity cutoff). Joins in service_location + customer context so the search UI renders in one round-trip.
- **`test_results` validation layer** — discriminated-union Zod schema keyed on `device_type` (RP / DC / PVB / SVB / AVB). AVB is inspection-only. `toTestResultInsert(v, ids)` normalizes empty strings to `null`, coerces PSI strings to `number | null`, and auto-stamps `review_status = 'approved'` (v1 solo-tester default). FIELD_LIMITS gains `shutoffCondition` (200) and `repairs` (5000). New primitive `optionalPsi` enforces `numeric(4,1)` shape (0–999.9) as strings.
- **`test_results` read helpers** — `listTestsForDevice`, `listRecentTests`, `getMostRecentTesterTest`. Join testers via the `!tester_id` hint (two FKs to testers — `tester_id` + `reviewed_by` — require disambiguation in PostgREST).
- **Unified search helper (`src/lib/db/search.ts`)** — parallel `Promise.all` over customers + service_locations (via tsvector) + devices (via the RPC). Per-type min-char: 2 for names, 3 for serials (Q4). Hand-written row types shadow the RPC's `RETURNS TABLE`.
- **Due-status module (`src/lib/dates/due-status.ts`)** — extracted from Phase-2's inline `deviceStatus`. New exports: `isOverdue`, `isDueSoon`, `bucketByDueStatus`, `DUE_SOON_WINDOW_DAYS = 60`. Phase-2's 30-day window bumped to 60 (Q5) — commercial customers need ~2 weeks to schedule; 30d surfaced things the tester couldn't act on yet. Window is parameterized so a Phase-5 per-company setting lands in one place.
- **Gauge-notice module (`src/lib/dates/gauge-notice.ts`)** — Q11 soft-notice logic. `isGaugeChanged(current, last)` flags when the tester's current gauge differs from their most recent submitted test's gauge. `isCalibrationStale(dateYmd, today, thresholdDays=365)` flags >12-month-old calibrations. Both non-blocking, never prevent submit.
- **Header search bar** — client component in the app shell. Debounced 200ms, popover results panel, grouped sections (Customers / Service Locations / Devices), per-row "Start Test" shortcut. `cmd/ctrl-K` focuses the input. Mobile layout hides the Customers nav link below `sm` so the bar has room.
- **`/tests/new` picker route** — dashboard CTA entry. Two tabs: Find customer / Enter serial. Customer tab reuses unifiedSearch's name branches; serial tab uses the trigram RPC. `?customer=X&location=Y` handed off via redirect to the Phase-2 hierarchy pages (no drill-down re-implementation).
- **Q13 add-new-device chain** — serial zero-result → `/customers?returnTo=/tests/new&serial=<q>`. Shared `AddDeviceBanner` component + `buildReturnToQuery` helper thread the params through customer list → customer detail → location detail → new-device form. Form prefills `serial_number` from URL, redirects to `${returnTo}?device=<newId>` after save. `/tests/new` resolves `?device=X` server-side and forwards to the canonical form URL. Every `returnTo` read goes through `safeNextPath`.
- **Canonical test form route** — `/customers/[id]/locations/[locId]/devices/[deviceId]/tests/new`. Server component fetches customer + location + device + tester profile + most-recent test (Q11 baseline) in parallel; chain-validates the FKs; renders a context card above the client `TestForm`.
- **Type-aware form body** — discriminated rendering per `device.type`. RP: CV1 + CV2 + Relief. DC: CV1 + CV2. PVB/SVB: CV + Air Inlet. AVB: inspection-only note, no PSIDs. Q11 soft notices (gauge-change + stale-cal) render inline under the respective Fields and re-evaluate live via `watch()`.
- **Fail → retest conditional** — `watch("result") === "fail"` unfolds a destructive-toned block with `repairs_made`, `retest_date`, per-type retest readings (RP/DC/PVB/SVB; AVB has none), and a three-option retest radio (Not retested / Retested & passed / Retested & failed). All schema-optional — a device can fail so badly no retest is possible.
- **Submit + redirect** — inline `.from("test_results").insert(toTestResultInsert(values, ids))` following the Phase-2 device-form pattern. `update_device_last_tested` trigger handles device denorm server-side. Success: toast + `router.push(backHref)` + `router.refresh()`. Error: `dbErrorMessage()` wrapper.
- **Device detail test history** — replaces the Phase-2 stub. Each row: `test_date`, effective pass/fail dot (retest_result wins, matches trigger logic), "(after retest)" label when an initial fail was retested successfully, notes snippet, tester initials. "Start a test" button in the section header makes the device detail a primary launch surface.
- **Dashboard bump** — three live sections replacing the "Phase 3-4 placeholder" card: Overdue (destructive badge + count), Due Soon (next 60 days, amber), Recent tests (newest 10 via `listRecentTests`). Rows cap at 10 per section with "+N more" footer; real show-all pagination is Phase 5.

**Phase 3 stats:**
- 25 routes live (was 23; +`/tests/new` and the canonical test form URL)
- 5 migrations applied to Supabase (+ `20260418010000_search_devices_by_serial_rpc.sql`)
- 277 Vitest tests passing (was 197; +80: test_results Zod, gauge-notice, search helper, due-status refactor expansion)
- `tsc --noEmit` + `npm run build` green

**Phase 4 stats:**
- 26 routes live (+`/customers/.../tests/[testId]/certificate`)
- 6 migrations applied to Supabase (+ `20260419000000_phase4_storage.sql`)
- 462 Vitest tests passing (was 340 post-Phase-3 test sweep; +57 new Phase 4 tests: `buildCertificateData` shape + branches, storage paths, recipient resolver, email payload builder)
- New deps: `@react-pdf/renderer 4.5.1`, `resend`, `@react-email/components`, `@react-email/render`
- `tsc --noEmit` + `npm run build` green
- **End-to-end verified in browser** on the dev env: generate → upload → signed URL returns a valid 7.4 KB `%PDF-` file served from the `certificates` bucket via the Phase-4 RLS policy.

**Dev DB state:**
- Seeded via `scripts/seed.ts` on 2026-04-18 (5 customers / 15 service locations / 23 devices)
- One extra test_results row created during unit-14 verification: `MT-DOM-001`, `test_date 2026-04-19`, `pass`, notes "Unit 14 submit verification. Safe to delete." — cleaned by next reseed.
- Seed target company UUID: `16eff77e-681a-4b4f-967e-2cc246e9a6b2`
- Reseed command: `ALLOW_SEEDING=true SEED_COMPANY_ID=16eff77e-681a-4b4f-967e-2cc246e9a6b2 npx tsx scripts/seed.ts`

**Routes currently shipped:**
```
/                       (redirect to /login or /dashboard)
/login, /signup
/reset-password, /reset-password/update, /check-email
/auth/callback, /auth/signout
/onboarding
/dashboard                                                    (Phase 3: 3 live cards; Recent rows link to certificate)
/settings, /settings/profile, /settings/company               (Phase 4: logo upload on /settings/company)
/tests/new                                                    (Phase 3: picker)
/customers, /customers/new
/customers/[id], /customers/[id]/edit
/customers/[id]/locations/new
/customers/[id]/locations/[locId], /customers/[id]/locations/[locId]/edit
/customers/[id]/locations/[locId]/devices/new
/customers/[id]/locations/[locId]/devices/[deviceId]          (Phase 4: test-history rows link to certificate)
/customers/[id]/locations/[locId]/devices/[deviceId]/edit
/customers/[id]/locations/[locId]/devices/[deviceId]/tests/new  (Phase 3: canonical test form)
/customers/[id]/locations/[locId]/devices/[deviceId]/tests/[testId]/certificate  (Phase 4)
```

**What's NOT done yet (Phase 5+ scope):**
- No test-result *detail* page — the certificate page is the landing page; a read-only per-test view with edit affordance is Phase 5+
- No customer portal
- No deployment to production Supabase / production Netlify site
- No paginated "show all tests" / "show all overdue" pages (Phase 5)
- No PWA manifest / service worker, no local form persistence
- Real Resend domain not yet verified — sends currently require a verified sender in the Resend dashboard
- No Resend webhook receiver — bounces/complaints aren't tracked server-side

## 3. Architecture

### Data model (4-level hierarchy)

```
Company (BackFLO tenant — the testing business)
  └── Testers (employees — the app users)

Customer (billing entity, e.g. "Acme Property Management")
  └── Service Location (physical property, e.g. "Acme Tower — 123 Main")
        └── Device (backflow assembly at that location)
              └── Test Result (one row per test event)
```

All company-scoped tables carry `company_id` and are behind RLS.

### Phase 2 additions

- **Validation (`src/lib/validation/`)** — customer, service-location, device Zod schemas plus shared `fields.ts` primitives: `requiredText`, `cappedOptionalText`, `optionalEmail`, `requiredStateCode`, `toOptionalEnum`, `toRequiredEnum`. `FIELD_LIMITS` is a single-source-of-truth const that mirrors the DB `char_length` CHECK constraints — paste-overflow surfaces as an inline "Max N characters" field error instead of a generic DB 23514 toast.
- **DB helper layer (`src/lib/db/`)** — `client.ts` (context helpers + `isUuid` guard + `getCurrentCompanyId()`), `customers.ts`, `service-locations.ts`, `devices.ts`. Each helper declares its own column set with `as const` so Supabase's generics infer the row shape and tsc verifies the hand-written `*ListRow` / `*DetailRow` types match. RLS does company-scoping; helpers don't re-filter.
- **Geocoder (`src/lib/geocode/`)** — Nominatim provider behind a single public `geocodeAddress()` entry point. Server-side, best-effort, async fire-and-forget after the DB write so the save UX isn't blocked by geocoder latency. Swap-path to Google is isolated to this one function.
- **Routes (`src/app/(app)/customers/*`)** — full 4-level hierarchy: list/new/detail/edit at the customer level, locations/new and locations/[locId]/{detail,edit}, devices/new and devices/[deviceId]/{detail,edit}. Shared forms use discriminated-union props for create+edit. Detail pages defense-in-depth verify parent chain before rendering.
- **Seed infrastructure** — `scripts/seed.ts` + `.env.seed` pattern. Gated by three safeguards: `ALLOW_SEEDING=true` must be explicit, `NEXT_PUBLIC_SUPABASE_URL` must contain `SEED_ALLOWED_PROJECT_REF`, and `SEED_COMPANY_ID` must be a valid UUID. Idempotent: wipes all customers for the target company before inserting (FK cascades).
- **New migration — `20260418000000_create_customer_with_location_rpc.sql`** — adds `create_customer_with_location()`. **SECURITY INVOKER** (not DEFINER): the caller already has INSERT rights via RLS; the RPC just provides atomicity for the "billing = service" toggle path so a customer can't be orphaned if the location insert fails.

### Phase 4 additions

- **`src/lib/pdf/`** — three files. `certificate-data.ts` is a pure data shaper that takes raw rows (`test_result + device + service_location + customer + tester + company`) and returns a flat, JSON-serializable `CertificateData` with a discriminated `readings` union (`rp` / `dc` / `pvb_svb` / `avb`) and optional `retest`. `certificate.tsx` is the `@react-pdf/renderer` component — one `Document` with a shared scaffold (header+logo, 3-card customer/location/device row, meta row, readings, shutoffs, retest card when set, notes, dual signature, footer) and type-aware readings branches. `render.ts` is a `renderToBuffer` wrapper — type-cast against the library's strict `ReactElement<DocumentProps>` signature is narrow and intentional.
- **`src/lib/storage/`** — `paths.ts` with `certificatePath(companyId, testResultId)` → `<uuid>/<uuid>.pdf`, `logoPath(companyId, ext)` → `<uuid>/logo.<png|jpg|jpeg|webp>`, UUID + ext guards throw on bad input (internal APIs, a bad call is a bug). `certificates.ts` exposes `uploadCertificatePdf` (upsert=true for idempotent retry) and `createCertificateSignedUrl` (60s TTL). `logos.ts` adds `fetchCompanyLogoDataUrl` (downloads via RLS, returns a data URL for `@react-pdf/renderer`), `createLogoPreviewUrl` (5min TTL for the settings page), and upload/delete. `errors.ts` mirrors `db/errors.ts` — never leak SDK text.
- **`src/lib/email/`** — `recipients.ts` builds the picker options (billing / on-site / custom) from `CertificateData`, dedupes case-insensitive. `certificate-email.ts` builds the Resend payload (subject, filename, HTML+text, PDF attachment). `client.ts` is a lazy-init Resend wrapper (server-only; env lookup at first send so missing keys don't crash unrelated imports). `templates/certificate-ready.tsx` is the React Email template with pass/fail branches.
- **New migration — `20260419000000_phase4_storage.sql`** — two private storage buckets (`certificates`, `company-logos`) + 8 RLS policies (4 verbs × 2 buckets), all gated on `(storage.foldername(name))[1] = public.user_company_id()::text`. No service-role anywhere.
- **Server actions — `.../tests/[testId]/certificate/actions.ts`** — `generateCertificate` (fetch → shape → render → upload → stamp `pdf_url` → return signed URL), `sendCertificate` (assumes generated; download → build payload → Resend → stamp `emailed_at/emailed_to`), `refreshCertificateDownloadUrl` (fresh 60s URL for Download). Each returns a discriminated `{ ok, … } | { ok: false, stage }` so the client can show stage-specific toast copy — never a generic "something went wrong."
- **Certificate route** — `/customers/[id]/locations/[locId]/devices/[deviceId]/tests/[testId]/certificate`. Server component chain-validates the URL against the test_result's FK columns (ground truth), renders a summary card + pass/fail badge, and mounts `CertificateActions` for Generate/Download/Email.
- **Logo upload on `/settings/company`** — a `LogoUpload` card sits above the company form. PNG/JPG/WebP, 2MB cap. Writes to `company-logos` and stamps `companies.logo_url`. Preview uses a 5-min signed URL server-side; after upload switches to a browser object URL for instant feedback.
- **Dashboard + device detail row links** — Recent Tests rows and device-detail test-history rows now click through to the certificate page (replaces Phase-3's deliberately non-clickable rows). `listRecentTests` picks up `service_location_id` so the dashboard link resolves.

### Phase 3 additions

- **Validation — `src/lib/validation/test-results.ts`** — discriminated-union Zod schema keyed on `device_type`. Five variants (RP/DC/PVB/SVB/AVB) extend a shared `baseTest` schema. `optionalPsi` primitive enforces `numeric(4,1)` shape as strings. `FIELD_LIMITS` gains `shutoffCondition` (200) and `repairs` (5000) mirroring the existing `test_results` char_length caps. `toTestResultInsert(v, ids)` strips the form-only `device_type` discriminator, coerces PSI strings to `number | null`, nulls non-applicable reading columns per variant, and auto-stamps `review_status = 'approved'`.
- **DB helpers — `src/lib/db/test-results.ts` + `src/lib/db/search.ts`** — read helpers only (writes live inline in the form component, matching the Phase-2 device-form pattern). `testers!tester_id(...)` column-name hint disambiguates the dual-FK join on `test_results`. `listActiveDevicesForDashboard` in `src/lib/db/devices.ts` pulls active devices + joined location + customer for the dashboard bucketing.
- **Date utilities — `src/lib/dates/`** — new folder. `due-status.ts` (extracted from Phase-2's inline `deviceStatus`) holds `isOverdue`, `isDueSoon`, `bucketByDueStatus`, `DUE_SOON_WINDOW_DAYS`. `gauge-notice.ts` holds `isGaugeChanged` + `isCalibrationStale` for the Q11 soft notices.
- **Routes (`src/app/(app)/tests/new` + the canonical test-form URL)** — two new routes. `/tests/new` is a picker shell that either redirects to a Phase-2 page (when context is present via `?customer=` / `?customer=&location=`) or renders two tabs (name vs serial search). The canonical URL `/customers/[id]/locations/[locId]/devices/[deviceId]/tests/new` is where the real test entry lives — server component fetches full context + renders a client form with type-aware bodies and conditional retest blocks.
- **Header search + app-shell bump** — `src/components/app/search-bar.tsx` is a client component wired to `unifiedSearch` with 200ms debounce, 2ch/3ch min, popover results, and a cmd/ctrl-K focus shortcut. `components/app/app-shell.tsx` re-flows on mobile to give the search room.
- **Add-device chain primitives — `src/components/app/add-device-banner.tsx`** — `AddDeviceBanner` + `buildReturnToQuery` helper keep the Q13 thread-through cheap across 5 Phase-2 pages.
- **New migration — `20260418010000_search_devices_by_serial_rpc.sql`** — `search_devices_by_serial(p_query, p_threshold, p_limit)`. SECURITY INVOKER; RLS-scoped; uses `similarity() > p_threshold` plus the `%` operator for index backing. Joins service_location + customer fields so callers render in one round-trip.

### Database (Supabase)

- **Project ID:** `oscalardqnipswcdwhke`
- **Name:** `backflo-dev`
- **Region:** `us-east-1` (N. Virginia, closest AWS region to South Florida)
- **Plan:** Free tier, $0/month
- **URL:** https://oscalardqnipswcdwhke.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/oscalardqnipswcdwhke
- **Organization:** `j-moreyra's Org` (`xcqlaihawxpansiwkcwe`)

**Tables (6):** `companies`, `testers`, `customers`, `service_locations`, `devices`, `test_results`.

**RLS pattern:** every company-scoped table has
`FOR ALL USING (company_id = public.user_company_id())`.
`public.user_company_id()` is `SECURITY DEFINER STABLE` and pulls the caller's `testers.company_id` by `auth.uid()`. Verified live: grantees are `{postgres, authenticated, service_role}` — `anon` is correctly absent.

**Signup atomicity (critical):**
`public.create_company_and_first_tester(17 params)` is a `SECURITY DEFINER` RPC that atomically inserts a company + the first tester row bypassing RLS. Callable only by `authenticated`; REVOKEd from `public`/`anon`. Contains guards:
- `auth.uid()` must be non-null
- No tester row may already exist for the caller
- Email pulled from `auth.users` (not a param — can't be spoofed)
- Trims + validates required strings
- Sets `trial_ends_at = now() + 14 days`, `role = 'owner'`, `subscription_status = 'trial'`
- `set search_path = public, auth` hardened against search-path hijacking

The client sends 13 of the 17 params; the other 4 (`next_due_calculation_method`, `license_issuing_authority`, `test_gauge_serial`, `test_gauge_calibration_date`) rely on the DB parameter defaults. This is intentional — see "Key Decisions".

**Triggers:**
- `set_updated_at()` → applied to all tables via per-table triggers
- `update_device_last_tested()` → after insert on `test_results`, recomputes the device's `last_tested_date`, `last_test_result`, and `next_test_due_date` using the company's configured `next_due_calculation_method` (four options: `test_date_plus_year`, `anniversary`, `calendar_year_end`, `custom`)

**Indexes:** standard FK indexes + GIN `tsvector` for `customers.search_vector` and `service_locations.search_vector` (weighted A/B/C/D), plus `pg_trgm` on `devices.serial_number` for fuzzy search. Partial index on `devices(company_id, next_test_due_date) WHERE is_active` for due-date dashboards.

### Authentication (Supabase Auth via `@supabase/ssr`)

- **Browser client:** `src/lib/supabase/client.ts` — used in client components
- **Server client:** `src/lib/supabase/server.ts` — used in server components / route handlers
- **Middleware:** `middleware.ts` (root) + `src/lib/supabase/middleware.ts` — refreshes session on every request, bounces unauthed users off protected routes
- **Public routes:** `/`, `/login`, `/signup`, `/reset-password*`, `/check-email`, `/auth/*`
- **Open-redirect guard:** `src/lib/auth/safe-next.ts` — shared by middleware, login page, and `/auth/callback` to validate `?next=` query params (rejects `//`, `https:`, `javascript:`, anything without a leading `/`)

### Deployment (Netlify)

- **Site ID:** `9a327740-e6b0-4218-9e4c-d2986e10b6cb`
- **Site name:** `backflo-app`
- **Primary URL:** https://backflo-app.netlify.app
- **Dashboard:** https://app.netlify.com/projects/backflo-app
- **Team:** `moreyraj13` (Pro plan, team ID `699f4c962c9e3832fb5f816c`)
- **GitHub integration:** Netlify site linked to `j-moreyra/backflo-app`. Pushes to `main` auto-deploy the primary URL; open PRs get ephemeral previews at `deploy-preview-N--backflo-app.netlify.app`. No manual deploys expected.
- **Build:** `npm run build`, publish `.next`, Node 22
- **Config:** [`netlify.toml`](netlify.toml) — Netlify's Next.js runtime v5 is auto-detected; no plugin declaration needed

### Environment variables

**Local dev (`.env.local` — gitignored):**
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → publishable key (`sb_publishable_` prefix; public by design)
- `RESEND_API_KEY` → blank (Phase 4)
- `RESEND_FROM_EMAIL` → blank (Phase 4)

**Seed script (`.env.seed` — gitignored, dev-only, NEW in Phase 2):**
- `SUPABASE_SERVICE_ROLE_KEY` → dev project service-role key
- `SEED_ALLOWED_PROJECT_REF` → `oscalardqnipswcdwhke` (the dev project ref)

Only `scripts/seed.ts` reads `.env.seed`. The app itself **still never reads the service-role key** — the original Phase 1 security principle is preserved.

**Do not add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.** An empty-string line (`KEY=`) counts as "set" in the dotenv loader and will block `.env.seed` from providing the real value. Learned the hard way during Phase 2 setup — symptom was a confusing "SUPABASE_SERVICE_ROLE_KEY is not set in .env.seed" error while the file looked correct.

A template lives at `.env.local.example` (gitignore whitelists this specific file).

**Netlify (set via MCP, all contexts, all scopes):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Supabase URL configuration:**
- **Site URL:** `https://backflo-app.netlify.app`
- **Redirect URLs:**
  - `http://localhost:3000/auth/callback` (dev)
  - `https://backflo-app.netlify.app/auth/callback` (prod)
  - `https://*--backflo-app.netlify.app/auth/callback` (deploy previews)

### Migrations (forward-only; timestamped `YYYYMMDDHHMMSS_name.sql`)

| File | What it does |
|---|---|
| `20260417000000_initial_schema.sql` | 6 tables + RLS policies + `user_company_id()` + triggers + indexes + search vectors |
| `20260417120000_signup_rpc.sql` | `create_company_and_first_tester` SECURITY DEFINER function |
| `20260417130000_length_constraints.sql` | `char_length` CHECK constraints on every user-text column (caps: names 200, emails 255, phones 50, notes 5000) |
| `20260418000000_create_customer_with_location_rpc.sql` | `create_customer_with_location()` SECURITY **INVOKER** — atomic customer + first service-location insert for the "billing = service" toggle. Stamps `company_id` from `user_company_id()`, not a parameter |
| `20260418010000_search_devices_by_serial_rpc.sql` | `search_devices_by_serial(p_query, p_threshold=0.3, p_limit=10)` SECURITY INVOKER. pg_trgm similarity backed by `idx_devices_serial_trgm`; joins service_location + customer context. Effective threshold floor is 0.3 (the `%` operator holds the default `pg_trgm.similarity_threshold` GUC) — tunable upward, not downward |
| `20260419000000_phase4_storage.sql` | Two private storage buckets (`certificates`, `company-logos`) + 8 RLS policies on `storage.objects` (4 verbs × 2 buckets) — all gated on the leading path segment matching `public.user_company_id()::text`. No service-role use. |

All six applied via the Supabase MCP's `apply_migration` tool.

## 4. Key Decisions

### Accepted
- **Stay on Next.js 16** (blueprint said 15; create-next-app pulls latest which was 16 — functionally equivalent, no downgrade needed).
- **`@supabase/ssr` cookie pattern** over legacy auth-helpers. Browser + server clients share cookies; middleware refreshes.
- **4-level hierarchy** (Customer → Service Location → Device → Test Result) — the key schema insight from the blueprint. Blueprint §2 explains why: one billing customer often has many physical properties.
- **Multi-tenant from day one** via RLS, even though Phase 1 is solo testers only.
- **No service-role key in app env.** Signup bypasses RLS exactly once via the SECURITY DEFINER RPC, never via a service-role shortcut. Keeps the attack surface smaller and prevents accidental escalation. **If you ever need an admin-only write, write another SECURITY DEFINER RPC — don't reach for the service-role key.**
- **`@react-pdf/renderer`** chosen in blueprint for Phase 4 PDF generation. Not yet installed.
- **Netlify over Vercel** (user request). Works cleanly with Next 16 via Netlify's v5 runtime.
- **shadcn/ui on base-ui (not Radix).** This means `DropdownMenuItem` uses the `render={<element />}` prop instead of Radix's `asChild`. Documented in CLAUDE.md.
- **Forward-only migrations.** Never edit an applied file — always add a new one. Once real users exist, PITR is the safety net (needs Supabase Pro).

### Explicitly rejected
- **Service-role key in `.env`** — rejected for security; would bypass RLS.
- **pgTAP / Playwright** — deferred past Phase 1 for scope. Noted as Phase-2 priority.
- **Full offline sync** — deferred per blueprint §8; v2+.
- **Scheduling / calendar / invoicing** — all deferred per blueprint §8.
- **Asking for `next_due_calculation_method` at onboarding** — removed. Testers don't know their utility's rule at signup; most want the default. DB parameter default (`'test_date_plus_year'`) kicks in when the client omits the arg.
- **Asking for gauge fields + license issuing authority at onboarding** — removed. Testers would need to walk to their truck to look up gauge info. All three moved to `/settings/profile` only.

### Phase 2 decisions

- **Nominatim for geocoding** — free, fair-use; swap path to Google deliberately isolated behind a single `geocodeAddress()` function.
- **Server-side geocoding on save** — lat/lng lands atomically with the row. Async (fire-and-forget) so save UX doesn't wait on geocoder latency. Failures swallowed and logged via `console.warn` for hit-rate monitoring.
- **Client-side filter for customer list in Phase 2** — real DB search (unified across customers/locations/devices) deferred to Phase 3 per the build plan.
- **"Type-aware" device form = just the type select + helper text** — real type-aware conditional fields live on the Phase 3 test-entry form, not on the device form.
- **Soft-delete via `is_active=false`** across customers, service_locations, devices. Hard-delete is out of scope. A "Deactivated" tag shows on detail headers when `is_active=false`.
- **"Billing = service" toggle on new-customer form only**, not on edit. Once customer + locations exist as separate rows they're edited independently (no cross-linked state to keep in sync).
- **Seed script security model** — `.env.seed` separate from `.env.local`; app never reads the service-role key; seed gated by `ALLOW_SEEDING` opt-in + project-ref match + UUID check.
- **`create_customer_with_location()` is SECURITY INVOKER, not DEFINER** — different from the Phase 1 signup RPC. The caller already has INSERT rights via RLS; we only need transaction atomicity. No privilege escalation needed, so SECURITY DEFINER would be unnecessary attack surface.

### Phase 4 decisions

- **One `Certificate` component with type-aware readings branches, not five.** RP/DC/PVB/SVB/AVB share ~80% of layout; branching a subcomponent (`ReadingsBlock`) is cheaper than 5 near-duplicates. Mirrors the test form's `PerTypeReadings` pattern — changes to the cert data shape get caught at the one diff site.
- **No service-role key in the Phase 4 server actions.** Storage writes flow through the caller's authenticated session; RLS policies on `storage.objects` gate on the leading path segment equalling `user_company_id()::text`. Preserves the project-wide rule from Phase 1.
- **Synchronous generate, not queued.** A single-page PDF renders in <200ms, so queuing adds infra cost without the latency payoff. The route returns on success with a signed URL; retries are idempotent because the storage key is deterministic. If renders ever grow past ~1s at scale, `renderToStream` + a background job is a two-file swap inside `src/lib/pdf/`.
- **Generate is a deliberate user action, not auto-on-save.** Keeps test submission and certificate generation decoupled so a PDF-render failure doesn't risk losing the test row. Device detail history rows link to the certificate page — tap through, then generate.
- **Certificate generation and email send are separate actions.** If email fails, `pdf_url` is already stamped — retry sending doesn't regenerate the PDF. Stage-discriminated return types (`{ ok: false, stage: "pdf" | "storage" | "db" }` etc.) let the client surface actionable toast copy instead of "something went wrong."
- **React Email for templates, not HTML strings.** Shared TSX/TS toolchain, typed props, same `CertificateData` source feeds PDF and email — no shape drift. `@react-email/render` produces the HTML at send time.
- **Signed-URL TTLs: 60s for certificate downloads, 5 min for logo previews.** Certificate URLs are for an immediate "tap to download" — leaked links expire fast. Logo previews render on an interactive settings page, so a 5-min TTL keeps re-renders cheap while still expiring.
- **Logos stored in a separate `company-logos` bucket.** Not in `certificates` because the path convention and TTL posture differ; a combined bucket would smear access patterns. Same RLS shape so one mental model covers both.
- **Private buckets only — no `public = true`.** Even logos aren't fully public content: a tester's logo is PII-adjacent. Everything flows through RLS + signed URLs.
- **Chain validation uses the `test_result` FK columns as ground truth,** not the nested-join IDs. A stale URL with consistent-looking joined IDs could still mismatch the test row's own FKs. Matches the defense-in-depth pattern from Phase 2 detail pages.
- **`generateCertificate` swallows logo-fetch failures.** Missing logo ≠ failed PDF. If the company has a logo path but Storage read fails, the render continues with a text-only header.
- **PNG/JPG/WebP for logos; no SVG.** `@react-pdf/renderer` handles raster natively; SVG requires extra setup (font resolution, path rasterization) that's not worth the Phase-4 scope.
- **`test_results.pdf_url` stores the bucket-qualified path (`certificates/<company>/<test>.pdf`)** rather than a signed URL. Signed URLs expire; the path is stable. The page regenerates a fresh signed URL via the refresh action whenever the Download button is clicked.

### Phase 3 decisions

The Q1–Q13 block was locked with the user before any code. Each Q/A captured below so a future session understands why the code looks the way it does.

- **Q1 — Test form layout: progressive single-page, not multi-URL wizard.** URL params collapse the form into the canonical route; steps 1–3 only render when context is missing. Beats a wizard because back-nav can't lose data and mobile keyboards don't fight.
- **Q2 — AVB handling: include, render inspection-only fields.** No PSID inputs, no readings in the retest block either. Pass/fail + shutoff + notes carry the record.
- **Q3 — Device serial search: `pg_trgm similarity()` from day one, not `ilike`.** Tester-typed serials are the canonical fuzzy-search case. `ilike` would need rewriting within two weeks of beta. Tunable threshold with a 0.3 floor (the `%` operator holds the default GUC).
- **Q4 — Debounce + min-char: 200ms, 2ch for names, 3ch for serials.** 2-char trigram queries return too much noise.
- **Q5 — Due-soon window defaults to 60 days, not 30.** Commercial customers need ~2 weeks to schedule; 30d surfaces things the tester can't act on yet. Parameterized so Phase 5 can wire a per-company setting.
- **Q6 — Retest flow = same `test_results` row.** Conditional fields revealed when initial result = fail. Matches the schema (retest_* columns all live on one row).
- **Q7 — `review_status = 'approved'` auto-stamped on insert.** v1 solo testers have no review workflow; the column remains for v2 multi-tester shops.
- **Q8 — "Start Test" from search = jump directly to canonical form.** Device rows link straight to the canonical test-form URL with customer/location/device context. Customer + location rows jump to `/tests/new?customer=X[&location=Y]`, which the picker resolves via redirect.
- **Q9 — Device-detail test history: latest 20, no show-all yet.** Pagination is Phase 5.
- **Q10 — localStorage form persistence: deferred to Phase 5** per blueprint §7.
- **Q11 — Gauge defaults from profile, editable inline, required at submit. Plus: soft yellow notice next to gauge when current differs from last-submitted; same for calibration date if >12 months old.** Non-blocking — gauge accuracy is load-bearing for cert validity so worth the minor scope add.
- **Q12 — No global `/tests` list page in Phase 3.** History is scoped to device / location / customer detail.
- **Q13 — Serial-search zero-result → `/customers?returnTo=/tests/new&serial=<q>` chain.** Thread-through pattern on customer list → customer detail → location detail → new-device form. `AddDeviceBanner` + `buildReturnToQuery` helper keep it compact. Every `returnTo` read passes through `safeNextPath`.

Additional Phase 3 calls:

- **Discriminated-union Zod schema on `device_type`.** RP/DC/PVB/SVB/AVB each have different reading fields; the discriminator is a form-only field (hidden input) stripped at submit time. The DB carries device type via the `device_id` FK, not a column on `test_results`.
- **`register` cast to a loose `UseFormRegister` type inside per-type sections.** The discriminated union's narrowing strips non-shared keys from the form's `errors`/register paths. Casting to `Record<string, FieldError>` for those sections is the documented escape hatch and kept narrowly scoped.
- **`PerTypeReadings` is a thin switch, not 5 separate components.** The variants share enough layout (grid, labels, hint copy pattern) that a single branching component is cheaper than 5 near-duplicates. Unit 12 tracks this as a conscious choice.
- **No `createTestResult` helper in `src/lib/db/test-results.ts`.** Matches the Phase-2 device-form pattern — writes live inline in the form component; the helper layer is reads only. Revisit if a second write site shows up.
- **Dashboard pulls every active device client-side, buckets in JS.** Simpler than a bucket-per-SQL-query and fine for MVP scale (<500 devices per company). Phase 5 adds pagination if a shop crosses that threshold.

### Patterns adopted
- **Validation:** shared Zod primitives in `src/lib/validation/fields.ts` (`requiredText`, `optionalText`, `optionalStateCode`, `requiredDate`, `optionalDate`, `nullIfEmpty`, `undefinedIfEmpty`). All schemas compose from these. Zod schemas operate on raw strings; normalization happens at submit via `to*Args`/`to*Update` helpers.
- **Forms:** shadcn Input/Label + shared `src/components/app/field.tsx` (label + error/hint), wrapped in `<fieldset disabled={submitting} className="block space-y-4 border-0 p-0 m-0 min-w-0">` to lock inputs during submit.
- **Error handling:** NEVER toast raw Supabase error text — it leaks schema names. Use `authErrorMessage()` (auth) or `dbErrorMessage(err, fallback)` (DB). Uncaught errors in (app) routes hit `src/app/(app)/error.tsx`.
- **Auth redirects:** `safeNextPath()` is the single source of truth — used in middleware, login page, and auth callback.
- **RPC arg helpers:** `to*RpcArgs()` functions return objects suitable for `supabase.rpc(...)`. They send `undefined` for unset optional fields so the Postgres parameter defaults kick in. Database-write helpers (`to*Update`) send `null` instead (matches PostgREST expectations for `.update({...})`).

## 5. Prior Work History

### Phase 1 — Auth + Onboarding + Settings (shipped 2026-04-17)
14 commits from repo init through onboarding polish. Delivered Supabase schema, RLS, the `create_company_and_first_tester` SECURITY DEFINER RPC, full auth flow (login/signup/reset/callback/signout), 2-step onboarding, app shell, dashboard stub, settings (profile + company), 3 migrations, 78 Vitest tests, and Netlify site provisioning. See commits through `8c86101`.

### Phase 2 — Customer/Location/Device CRUD (shipped 2026-04-18)
13 commits shipped the full customer → service-location → device hierarchy:

- Validation schemas (customers, service-locations, devices) composed from shared `fields.ts` primitives; FIELD_LIMITS mirrors DB caps.
- Typed DB helper layer (`src/lib/db/`) with `as const` column sets and `isUuid` guards before round-trips.
- Customer pages — list/new/detail/edit; "billing = service" toggle on new-customer creates customer + first location in one transaction.
- Service-location pages — new/detail/edit + new `create_customer_with_location` RPC (SECURITY INVOKER, atomicity only).
- Device pages — new/detail/edit; colored-dot status card (overdue / due-soon / current / never-tested); Phase-3 test-history placeholder.
- Nominatim geocoder behind a single `geocodeAddress()` entry point; fire-and-forget stamps lat/lng post-save.
- Seed script (`scripts/seed.ts`) + `.env.seed` pattern; triple-gated safeguards.
- Review fixes — SF-1 literal SELECT inference (`as const`), SF-2 UUID guards on detail/child-list fetches, SF-3 `optionalEmail` primitive, SF-5 DB char_length caps mirrored in Zod.
- UI polish — deviceStatus boundary fix (lexical YYYY-MM-DD + UTC delta), Base UI `nativeButton` warnings resolved across 8 sites, app-shell Customers link, dashboard CTAs, loading skeletons.

197 tests passing (78 → 197). tsc + build green. Deploy preview on Netlify green.

### Phase 4 — PDF + Email (shipped 2026-04-19)

Seven commits (`7d4b2e8` through `6a44341`) landed the full capture → PDF → email loop end-to-end on the dev environment.

- **Foundation (units 1–4):** storage migration applied via MCP (2 buckets + 8 RLS policies); `buildCertificateData` pure shaper + 24 tests; `Certificate` React-PDF component with RP/DC/PVB/SVB/AVB branches + `renderToBuffer` wrapper; storage path builders + upload/download helpers + 15 tests.
- **UI (unit 5):** `LogoUpload` on `/settings/company` — private bucket, 5-min signed URL preview, browser object URL after upload for instant feedback, deletes stale logos when extension changes.
- **Email (units 6–7):** `recipients.ts` → picker options with case-insensitive dedupe (11 tests); `certificate-email.ts` → subject/filename/payload builder (7 tests); React Email template with plain-text fallback; `client.ts` lazy-init Resend wrapper.
- **Actions + page + links (units 8–10):** `generateCertificate` / `sendCertificate` / `refreshCertificateDownloadUrl` server actions with stage-discriminated results; `/tests/[testId]/certificate` page with chain validation + summary card + actions component; device-detail history rows and dashboard Recent Tests rows now link through to the certificate page (replaces Phase-3's deliberately non-clickable rows).
- **Verification:** clicked Generate PDF in the preview on the seeded `MT-DOM-001` row — toast "Certificate generated", UI flipped to Regenerate/Download, signed URL returned a 7.4 KB `%PDF-` file. Confirmed end-to-end through storage RLS without needing service-role.

340 → 462 tests. 25 → 26 routes. 5 → 6 migrations. `tsc` + `build` green.

### Phase 3 — Unified search + Test entry + Dashboard (shipped 2026-04-19)
15 commits landed the full test-entry loop end-to-end on the dev environment. Commits from `0b618b2 feat(db): add search_devices_by_serial RPC for fuzzy serial lookup` through `837cebb feat(dashboard): Overdue + Due Soon + Recent Tests cards`.

- **Foundation (units 1–6):** new `search_devices_by_serial` RPC (pg_trgm); discriminated-union `test_results` Zod schema + `optionalPsi` primitive + FIELD_LIMITS additions (shutoffCondition 200, repairs 5000); `test_results` read helpers (`listTestsForDevice`, `listRecentTests`, `getMostRecentTesterTest`); unified-search helper; refactored due-status module extracted to `src/lib/dates/` with 60-day default window.
- **Search UI (units 7–8):** client-side header search bar. Grouped results (Customers / Service Locations / Devices), per-row "Start Test" shortcut, 200ms debounce, cmd/ctrl-K focus, mobile-responsive nav collapse.
- **Test entry flow (units 9–14):** `/tests/new` picker (two tabs: name / serial); Q13 add-new-device chain threaded through 5 Phase-2 pages via `buildReturnToQuery` + `AddDeviceBanner`; canonical test-form route with server-side context fetch; type-aware form body with Q11 gauge soft notices via `watch()`; fail-then-retest conditional block; submit wiring → trigger-driven device denorm confirmed live.
- **History + dashboard (units 15–16):** device detail gets a real test-history panel (date · effective pass/fail · tester initials · notes snippet); dashboard replaces the placeholder card with Overdue + Due Soon (60d) + Recent Tests sections fed by `listActiveDevicesForDashboard` + `bucketByDueStatus` + `listRecentTests`.
- **Preview verification** every UI-observable unit. End-to-end submit landed a real `test_results` row; the `update_device_last_tested` trigger denormalized `last_tested_date`, `last_test_result`, `next_test_due_date` on schedule. Leftover dev DB row noted in § Current Status.

197 → 277 tests. 23 → 25 routes. 4 → 5 migrations. tsc + build green throughout.

## 6. Active Issues

**No blocking issues.** Build is clean, tests pass (462), deploy preview green, end-to-end certificate generation verified in the browser against the dev Supabase.

**Open items / risks (non-blocking):**
- **Pick a domain** — backflo.app / backflo.com / getbackflo.com / backflo.io still unchecked.
- **USPTO trademark search for "BackFLO"** — pending.
- **Production Netlify site not yet connected** — deploy preview only.
- **Resend API key not yet provisioned** — `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local.example` are blank stubs. PDF generation works without them; email sending requires both to be set + a verified Resend sender. Needed before first paying customer.
- **No pgTAP / Playwright yet.** Unit tests cover Zod schemas, helpers, the open-redirect guard, DB helper guards, geocoder parsing, FIELD_LIMITS drift, due-status buckets, gauge-notice helpers, certificate data shaping, storage path builders, email recipient/payload builders (462 tests). Not covered: RLS enforcement, signup RPC runtime guards, trigger math for all 4 due-date methods, end-to-end browser flow, live Nominatim fetch, `@react-pdf/renderer` rendering output, Resend SDK.
- **No Resend webhooks.** Bounces + complaints aren't tracked. First-customer milestone or before.
- **No Supabase PITR.** Free tier doesn't offer point-in-time recovery. Once paying customers exist, upgrade is strongly recommended before schema changes that affect data.
- **No error-reporting / observability.** No Sentry yet.
- **`@netlify/plugin-nextjs` not explicitly pinned** in `netlify.toml` — relying on auto-detection.
- **Test-form `test_date` default uses server-local wall clock**, not the tester's. If the Netlify function runs in a different timezone from the tester, today's date can be off by one. Phase 5 should move this to a client component that reads the browser's `new Date()`. Tracked in `src/app/.../tests/new/page.tsx` next to `todayYmdServerLocal`.
- **Leftover dev DB test row.** The unit-14 end-to-end submit verification inserted a real row on `MT-DOM-001` with notes "Unit 14 submit verification. Safe to delete." It cascades away on next seed; harmless to leave but tracked here so it doesn't surprise anyone reading dev data.
- **SVB certificate render not visually verified.** Unit test covers the data-shaping branch, PVB shares the same render branch and is verified, but no SVB device exists in seed to render one end-to-end. Low priority; SVBs are uncommon in the target segment.

## 7. Next Steps

Ordered by dependency / priority.

**Phase 2 — Customers + Service Locations + Devices CRUD** (blueprint §7 Phase 2, days 4–9) — ✅ complete:
- [x] Customer list + detail + add/edit form
- [x] Service Location list (on Customer detail) + detail + add/edit form
- [x] Device list (on Service Location detail) + detail + add/edit form (type-aware: RP / DC / PVB / SVB / AVB)
- [x] Address geocoding on service location save (Nominatim)
- [x] Seed script with realistic hierarchical data (5 customers × 15 locations × 23 devices)
- [x] Blueprint UX toggle: "Is billing address the same as service address?" → creates Customer + Service Location in one step via `create_customer_with_location` RPC

**Phase 3 — Unified search + Test entry + Dashboard** (blueprint §7 Phase 3, days 10–15) — ✅ complete:
- [x] Unified search bar in app header (customers + service locations + devices)
- [x] Search result UI: three grouped sections, "Start Test" shortcut per row
- [x] New Test multi-step flow: entry by customer OR by device serial; type-aware test entry form; smart defaults from tester profile
- [x] Save `test_result` → existing trigger updates device automatically (verified live)
- [x] Device detail test history (replaces Phase-2 stub)
- [x] Dashboard: Overdue + Due Soon + Recent Tests cards
- [x] Q13 zero-result add-new-device chain (returnTo + serial threading)
- [x] Q11 gauge-change + stale-calibration soft notices

**Phase 4 — PDF + Email** (blueprint §7 Phase 4, days 16–20) — ✅ complete:
- [x] `@react-pdf/renderer` certificate with company logo, all device-type variants
- [x] Upload generated PDFs to Supabase Storage (bucket + RLS policy in `20260419000000_phase4_storage.sql`)
- [x] Resend integration for transactional email — code complete; awaiting API key provisioning
- [x] "Email to..." with choice of billing vs. on-site contact email (+ custom free-text)

**Phase 5 — Polish + PWA** (blueprint §7 Phase 5, days 21–24):
- [ ] Mobile QA on real iPhone + Android
- [ ] Empty/loading/success states
- [ ] PWA manifest + service worker (installable)
- [ ] Local form state persistence
- [ ] License expiration warnings on dashboard (30/60/90 days)
- [ ] Due-date calculation method setting prominently in `/settings/company` (already there; just ensure UX)

**Testing backlog (parallel to phases):**
- [ ] pgTAP or SQL-level tests: RLS enforcement, `create_company_and_first_tester` guards, `update_device_last_tested` math for all 4 due-date methods
- [ ] Playwright e2e: signup → confirm → onboarding → dashboard, covering Phase 1 first

**Infrastructure (before first paying customer):**
- [ ] Upgrade Supabase to Pro for PITR + branches
- [ ] Add Sentry (or similar) for client-side error tracking
- [ ] Privacy policy + terms of service page (we collect real PII; legal prerequisite for inviting design partners)

**Deferred per blueprint §8** (don't do until explicit trigger):
- Public customer booking URL, customer portal, multi-tester review workflow, invoicing, utility submission integration, scheduling, full offline sync, bulk import, QuickBooks integration, Google Maps routing, Stripe billing UI, digital PDF signatures

## 8. Context Notes

### How the assistant worked on this project
- User set a "work in units, propose → go → build → verify → commit → test → stop" pattern mid-Phase-1, then loosened to "larger chunks before checking in" because progress was too slow.
- Auto-mode has been active since early in the project.
- User prefers terse, direct communication. Hates fluff. Expects honest pushback on bad ideas (e.g., questioned the due-date-rule field at onboarding; agent agreed and removed it).

### Gotchas that took more than one attempt to figure out
- **shadcn DropdownMenuItem doesn't have `asChild`.** Shadcn's new UI is on base-ui, not Radix. The equivalent is `render={<Link />}` or `render={<button type="submit" />}`. First sign-out implementation threw a TS error; fixed by switching to `render={...}`.
- **Zod 4 is installed, not Zod 3.** Some v3 patterns have moved (e.g., `z.email()` is now preferred top-level, though `z.string().email()` still works). Chained `.trim().refine().transform()` works fine in v4.
- **create-next-app@latest installs Next 16, not 15.** Blueprint said 15. No downgrade applied — Next 16 works cleanly with everything.
- **Sonner `Toaster` needs `next-themes` but works without a `<ThemeProvider>`** — `useTheme()` returns undefined and the `{ theme = "system" }` destructure default kicks in. Don't bother adding a ThemeProvider unless you actually want theme switching.
- **Netlify MCP can create sites + set env vars but can't link GitHub.** GitHub linking requires OAuth; user has to do it in the Netlify dashboard once.
- **`fieldset` defaults include a border.** Added `border-0 p-0 m-0 min-w-0` Tailwind utilities to neutralize.
- **The Netlify CLI (`netlify-cli`) is globally installed but not logged in.** Tried during deploy; skipped because the MCP + dashboard OAuth got us further without a login prompt.
- **`search_params.next` validation is duplicated defensively.** Middleware, login page, and `/auth/callback` all run `safeNextPath()` independently. This is intentional — defense in depth.

### Lessons learned from Phase 2 shipping

- **Worktree + session safety** — running `git worktree remove` while a Claude Code session is active inside that worktree kills the session and the transcript is unrecoverable. Close the session first, then remove the worktree.
- **Start sessions with the worktree checkbox OFF** — for solo workflow in a single repo, worktree mode adds indirection and risk. Leave unchecked for Phase 3 sessions.
- **Stale remote branches survive local deletion** — `git branch -d` only cleans up local. Remote cleanup requires `git push origin --delete <branch>`. Always check `git branch -r` before closing out a phase.
- **Branch push ≠ PR merge** — verify the "Merged" badge on the PR before deleting backup branches. A pushed-but-unmerged PR branch can create confusion weeks later.
- **Avoid GitHub's web editor for code files** — bypasses local `tsc --noEmit`, bypasses CLAUDE.md rules, bypasses commit message conventions. Web editor is fine for README typos; not fine for `.ts` files.
- **Empty env vars are not unset env vars** — `KEY=` (no value) counts as "set" in most dotenv loaders. If `.env.seed` needs to provide a value and `.env.local` has an empty line for that key, `.env.local` wins and seeds fail confusingly. Delete empty lines entirely.
- **Complete files only when handing off code** — placeholder comments ("paste data here") in code handoffs cause ~3-hour recovery sessions. Always reproduce the full file.

### Lessons learned from Phase 4 shipping

- **`@react-pdf/renderer` v4's `renderToBuffer` has an overly-strict `ReactElement<DocumentProps>` parameter type.** A wrapping function component (even when it returns `<Document>`) doesn't satisfy it. Narrow `as ReactElement<DocumentProps>` cast inside `src/lib/pdf/render.ts` is the ergonomic fix — runtime is correct.
- **@react-pdf/renderer style arrays reject `undefined` entries.** Conditional `[base, cond ? extra : undefined]` triggers TS2769; use `cond ? [base, extra] : base` instead.
- **Nullish coalescing (`??`) silently erases explicit `null` overrides in test fixtures.** When a helper accepts `{ email?: string | null }` and the default is `"foo@bar"`, passing `{ email: null }` with `o.email ?? default` returns the default, not null. Use `"email" in o ? o.email : default` or destructured defaults. Cost a cycle of red tests.
- **Supabase storage RLS uses `(storage.foldername(name))[1]`, not the bucket path.** For bucket `certificates` and object `<uuid>/<uuid>.pdf`, `storage.foldername(name)` returns `{<uuid>}` — index `[1]` (Postgres arrays are 1-indexed). Confirmed working live by uploading a 7.4 KB PDF and reading it back via a 60s signed URL.
- **`storage.buckets` INSERTs need `on conflict do nothing`** — re-running a migration (rare, but during dev iteration) would otherwise fail on bucket duplicates.
- **`test_results` has `pdf_url`, `emailed_at`, `emailed_to` already provisioned from Phase 1 initial schema.** Phase 4 re-used them instead of adding a certificates table. One fewer table to RLS-gate.
- **Lazy Resend init beats module-load init.** When `RESEND_API_KEY` is blank (as it is pre-provisioning), a module-load `new Resend(process.env.RESEND_API_KEY)` would throw during any import chain that touches `src/lib/email/client.ts` — e.g., `npm run build` or a tsc check. Moving the env read to first-send keeps the build green and isolates the failure to the action call.
- **Signed-URL TTLs want two tiers.** 60s for certificate downloads (immediate-action, expires before the link escapes the browser), 5min for logo previews (interactive settings page, cheap re-renders). One TTL for everything would either churn unnecessarily or leak stale links.
- **React Email's `render` needs `await`.** In 2026's version it's async. A forgotten await returns a Promise the attachment payload can't serialize — surfaces as a confusing "html is not a string" at send time. The payload builder awaits it.
- **Dashboard Recent Tests rows intentionally lacked `service_location_id` in Phase 3.** Adding it was a one-line change to the `RECENT_COLUMNS` const; now the certificate link resolves without falling back to a search-and-pick round-trip.

### Lessons learned from Phase 3 shipping

- **`test_results` has two FKs to `testers`** (`tester_id` for who ran the test + `reviewed_by` for the v2 review workflow). PostgREST refuses to auto-embed when there's ambiguity — use the `testers!tester_id(cols)` column-name hint on any joined `.select`. Error surfaces at tsc time (`SelectQueryError<"...more than one relationship...">`).
- **`pg_trgm similarity()` has a GUC-backed floor.** The `%` operator in the RPC applies `pg_trgm.similarity_threshold` (default 0.3) to its index scan. A caller-supplied threshold below 0.3 effectively still filters at 0.3. Documented at the migration file. To tune below 0.3 you'd need `set_limit()` (session-scoped, ugly) or drop the `%` predicate and accept a seq scan. Neither worth it at current scale.
- **React-hook-form + Zod discriminated union = narrowing pain.** `errors.check_valve_1_psid` fails to type-check because TS strips per-variant keys from the form's `FieldErrors<T>`. The documented escape hatch — casting errors to `Record<string, FieldError | undefined>` inside the per-type body — is what I ended up with. The Zod runtime behavior is exactly right; only the TS narrowing needs the cast.
- **`server-local today` ≠ `tester today`.** Defaulting `test_date` to a date string computed in the server component means testers east/west of the Netlify function's timezone see yesterday's/tomorrow's date prefilled near midnight. Noted in Active Issues; Phase 5 fix moves it client-side.
- **Preview verification during UI-heavy units catches real bugs, not type bugs.** Killing the user's own dev server to run `preview_start` worked cleanly — `kill <pid>` + `preview_start` + verify + `preview_stop` hands the port back with no lasting damage. Zero-state sessions (fresh cookie jar) require a login, so the user signing in via the preview for you is the simplest path.
- **Threading URL params through 5 routes is cheaper than it looks.** The `returnTo` + `serial` pattern (Q13) touched customer list + customer detail + location detail + new-device form + device-form submit, but `buildReturnToQuery` + `AddDeviceBanner` kept each touch to <10 lines. No shared state machine, no sessionStorage magic, every link is self-explanatory in the URL bar.
- **Start session with a clean todo — don't carry over unfinished "post-unit" items between phases.** The unit 10 → preview-verification flow created a one-off "Post-unit-10 preview verify" todo that needed manual cleanup. For Phase 4, bake verification into each unit's definition so it doesn't spawn orphans.

### Repos / accounts

- **GitHub repo:** https://github.com/j-moreyra/backflo-app (public) ✓
- **Supabase:** `backflo-dev` project active ✓
- **Netlify:** site linked to `j-moreyra/backflo-app`. Pushes to `main` auto-deploy the primary URL at https://backflo-app.netlify.app; open PRs get ephemeral previews at `deploy-preview-N--backflo-app.netlify.app`. No manual deploys expected.
- **Resend:** integration code shipped Phase 4 but account/API key + verified sender not yet provisioned. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` remain blank stubs in `.env.local.example`; populate both + add them to Netlify env + verify a domain before first paying customer.
- **Stripe:** not yet set up (post-MVP)

### Conventions (see `CLAUDE.md` for the full list)
- Test files live next to source: `src/lib/validation/auth.test.ts` next to `auth.ts`
- Folder namespaces: `components/app/`, `components/auth/`, `components/ui/` — keep shadcn primitives at the leaves
- All forms use `mode: "onTouched"` for Zod validation — validates on blur, not on every keystroke
- `reset(values)` after successful save in settings forms so the Save button goes disabled again (`isDirty` tracking)

### External resources / dashboards
- Supabase dashboard: https://supabase.com/dashboard/project/oscalardqnipswcdwhke
- Supabase SQL editor: https://supabase.com/dashboard/project/oscalardqnipswcdwhke/sql/new
- Supabase auth → URL Configuration: https://supabase.com/dashboard/project/oscalardqnipswcdwhke/auth/url-configuration
- Netlify dashboard: https://app.netlify.com/projects/backflo-app
- GitHub repo: https://github.com/j-moreyra/backflo-app

### How to pick up work in a new chat
1. Read this file and `BackFLO_MVP_Blueprint.md`
2. Read `CLAUDE.md` for conventions
3. `git log --oneline -10` to see the latest commits
4. `npm test && npm run build` to confirm the baseline is green
5. Check `/settings/company` and `/settings/profile` in your local dev to orient on the current UI
6. Blueprint §7 has the phase-by-phase build plan — next phase is Phase 2 (Customers + Service Locations + Devices)
