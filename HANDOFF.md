# HANDOFF.md — BackFLO

> Last updated: 2026-04-18. Phase 2 complete.

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
- Resend (Phase 4, not yet wired), Stripe (later)
- `@react-pdf/renderer` (Phase 4)

**Key directories:**
- `src/app/` — Next.js App Router pages/layouts
- `src/lib/supabase/` — client/server/middleware wrappers + generated types
- `src/lib/validation/` — Zod schemas and shared field primitives
- `src/lib/auth/` — auth error mapper + safe-next path validator
- `src/lib/db/` — generic DB error wrapper
- `src/components/app/` — shell UI (header, field, back-link, sign-out)
- `src/components/auth/` — auth-shell card layout
- `src/components/ui/` — shadcn primitives (don't hand-edit; regenerate via `npx shadcn@latest add`)
- `supabase/migrations/` — forward-only SQL migrations

**Reference docs:**
- [`BackFLO_MVP_Blueprint.md`](BackFLO_MVP_Blueprint.md) — product spec, source of truth
- [`CLAUDE.md`](CLAUDE.md) — working-with-the-code conventions
- [`AGENTS.md`](AGENTS.md) — Next.js 16 heads-up (imported by CLAUDE.md)

## 2. Current Status

**Phase 2 (Customer/Location/Device CRUD) — complete and merged to main. Phase 3 (Search + Test Entry + Dashboard) — not started.**

- **GitHub:** https://github.com/j-moreyra/backflo-app (public)
- **Active branch:** `main`
- **Latest commit:** `4a54de4 fix(ui): resolve Base UI nativeButton warnings across 8 call sites`
- Deployed to Netlify deploy preview. Production Netlify site not yet connected.

**Phase 2 delivery (13 commits, squash-merged via PR #1):**
- **Validation schemas** — customer, service-location, device Zod schemas built on shared primitives (`fields.ts`: requiredText, cappedOptionalText, optionalEmail, requiredStateCode, toOptionalEnum, toRequiredEnum). FIELD_LIMITS mirrors the DB char_length caps.
- **DB helper layer** — `src/lib/db/` — client.ts (context helpers, `isUuid` guard, `getCurrentCompanyId`), customers.ts, service-locations.ts, devices.ts. Column sets declared `as const` so Supabase's generics infer exact row shapes.
- **Customer pages** — list / new / detail / edit. Billing=service toggle on new-customer form creates customer + first location atomically via RPC.
- **Service-location pages** — new / detail / edit. Shared form via discriminated-union props. Defense-in-depth guard: verifies location.customer_id matches URL [id].
- **Device pages** — new / detail / edit. Same discriminated-union form pattern. Status card with colored dot (overdue / due-soon / current / never-tested). Phase 3 test-entry placeholder.
- **Geocoding** — Nominatim provider behind a single `geocodeAddress()` entry point. Server-side, fire-and-forget after save.
- **Seed script** — `scripts/seed.ts` + `.env.seed` pattern. Gated by three safeguards (ALLOW_SEEDING, project-ref match, UUID validation).
- **Review fixes** — SF-1 (literal SELECT inference), SF-2 (UUID guards), SF-3 (email validation), SF-5 (DB length caps mirrored in Zod).
- **UI polish** — deviceStatus boundary fix (lexical YYYY-MM-DD compare + UTC delta), Base UI nativeButton warnings resolved, app-shell Customers nav, dashboard CTAs, loading skeletons.

**Phase 2 stats:**
- 23 routes live (was 13; +10 customer/location/device routes)
- 4 migrations applied to Supabase (+ `20260418000000_create_customer_with_location_rpc.sql`)
- 197 Vitest tests passing (was 78)
- `tsc --noEmit` + `npm run build` green

**Routes currently shipped:**
```
/                       (redirect to /login or /dashboard)
/login, /signup
/reset-password, /reset-password/update, /check-email
/auth/callback, /auth/signout
/onboarding
/dashboard
/settings, /settings/profile, /settings/company
/customers, /customers/new
/customers/[id], /customers/[id]/edit
/customers/[id]/locations/new
/customers/[id]/locations/[locId], /customers/[id]/locations/[locId]/edit
/customers/[id]/locations/[locId]/devices/new
/customers/[id]/locations/[locId]/devices/[deviceId]
/customers/[id]/locations/[locId]/devices/[deviceId]/edit
```

**What's NOT done yet (Phase 3+ scope):**
- No unified search (customers + locations + devices)
- No test entry flow
- No PDF generation (Phase 4)
- No transactional email delivery / Resend integration (Phase 4)
- No customer portal
- No deployment to production Supabase / production Netlify site

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
- **GitHub integration:** linked to `j-moreyra/backflo-app`; pushes to `main` auto-deploy prod; PRs get deploy previews
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

All four applied via the Supabase MCP's `apply_migration` tool.

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

## 6. Active Issues

**No blocking issues.** Build is clean, tests pass (197), deploy preview green.

**Open items / risks (non-blocking):**
- **Pick a domain** — backflo.app / backflo.com / getbackflo.com / backflo.io still unchecked.
- **USPTO trademark search for "BackFLO"** — pending.
- **Production Netlify site not yet connected** — deploy preview only.
- **Resend API key not yet configured** — Phase 4 need.
- **No pgTAP / Playwright yet.** Unit tests cover Zod schemas, helpers, the open-redirect guard, DB helper guards, geocoder parsing, and FIELD_LIMITS drift (197 tests). Not covered: RLS enforcement, signup RPC runtime guards, trigger math for all 4 due-date methods, end-to-end browser flow, live Nominatim fetch.
- **No Supabase PITR.** Free tier doesn't offer point-in-time recovery. Once paying customers exist, upgrade is strongly recommended before schema changes that affect data.
- **No error-reporting / observability.** No Sentry yet.
- **`@netlify/plugin-nextjs` not explicitly pinned** in `netlify.toml` — relying on auto-detection.

## 7. Next Steps

Ordered by dependency / priority.

**Phase 2 — Customers + Service Locations + Devices CRUD** (blueprint §7 Phase 2, days 4–9) — ✅ complete:
- [x] Customer list + detail + add/edit form
- [x] Service Location list (on Customer detail) + detail + add/edit form
- [x] Device list (on Service Location detail) + detail + add/edit form (type-aware: RP / DC / PVB / SVB / AVB)
- [x] Address geocoding on service location save (Nominatim)
- [x] Seed script with realistic hierarchical data (5 customers × 15 locations × 23 devices)
- [x] Blueprint UX toggle: "Is billing address the same as service address?" → creates Customer + Service Location in one step via `create_customer_with_location` RPC

**Phase 3 — Unified search + Test entry** (blueprint §7 Phase 3, days 10–15):
- [ ] Unified search bar in app header (customers + service locations + devices)
- [ ] Search result UI: three grouped sections, "Start Test" shortcut per row
- [ ] New Test multi-step flow: entry by customer OR by device serial; location select; device select with status indicators (⚠️ overdue / 🔜 due soon / ✅ current / 🆕 never tested); type-aware test entry form; smart defaults from tester profile
- [ ] Save `test_result` → existing trigger updates device automatically

**Phase 4 — PDF + Email** (blueprint §7 Phase 4, days 16–20):
- [ ] `@react-pdf/renderer` certificate with company logo, all device-type variants
- [ ] Upload generated PDFs to Supabase Storage (bucket needs creation + RLS policy)
- [ ] Resend integration for transactional email
- [ ] "Email to..." with choice of billing email vs. on-site contact email

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

### Repos / accounts

- **GitHub repo:** https://github.com/j-moreyra/backflo-app (public) ✓
- **Supabase:** `backflo-dev` project active ✓
- **Netlify:** deploy preview active at `deploy-preview-2--backflo-app.netlify.app`; production site not yet connected
- **Resend:** not yet set up (Phase 4)
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
