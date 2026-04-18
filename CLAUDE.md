@AGENTS.md

# BackFLO — working-with-the-code notes

Source of truth for the product spec: `BackFLO_MVP_Blueprint.md`.
This file is conventions only.

## Stack snapshot

- Next.js 16 (App Router, Turbopack) + TypeScript strict
- Supabase (Postgres, Auth, Storage) — multi-tenant via RLS from day one
- Tailwind 4 + shadcn/ui (built on base-ui — **not** Radix)
- Zod 4 + react-hook-form + `@hookform/resolvers`
- Sonner for toasts; next-themes feeds the Sonner theme
- Vitest for unit tests; no e2e harness yet
- Netlify for hosting (not yet provisioned at time of writing)

## Folder layout

```
src/
  app/
    (auth)/                auth-group pages (no shell): login, signup,
                           reset-password[/update], check-email
    (app)/                 authed + onboarded shell:
                             layout.tsx (auth gate)
                             dashboard/
                             settings/{profile,company,...}
                             error.tsx (app-scope error boundary)
    auth/                  route handlers: callback (GET), signout (POST)
    onboarding/            2-step setup form (own gate, no app shell)
    page.tsx               root — server-side auth redirect
    layout.tsx             root layout; metadata + <Toaster />
  components/
    app/                   app-shell UI (header, field, back-link,
                           sign-out-item) — used inside (app) routes
    auth/                  auth-shell (card layout used by (auth) pages)
    ui/                    shadcn primitives — do not edit freely;
                           regenerate via `npx shadcn@latest add <name>`
  lib/
    auth/                  errors.ts (code → friendly copy),
                           safe-next.ts (open-redirect guard)
    db/                    errors.ts — generic DB error wrapper
    supabase/              client, server, middleware, Database types
    validation/            Zod schemas and shared field primitives
supabase/
  migrations/              forward-only; timestamped YYYYMMDDHHMMSS_name.sql
```

## Conventions

**Validation.** Shared Zod primitives live in `src/lib/validation/fields.ts`
(`requiredText`, `optionalText`, `optionalStateCode`, `requiredDate`,
`optionalDate`, `nullIfEmpty`, `undefinedIfEmpty`). Schemas compose from
these — don't inline new primitives. Form values stay as plain strings
all the way through Zod; normalization to `null` (for `.update()`) or
`undefined` (for `.rpc()`) happens at submit time via the to*-helpers.

**Forms.** All form fields use `src/components/app/field.tsx` for
label/error/hint layout. Wrap form controls in
`<fieldset disabled={submitting} className="block space-y-4 border-0 p-0 m-0 min-w-0">`
so inputs lock alongside the submit button. Use react-hook-form with
`mode: "onTouched"` and `zodResolver`.

**Error handling.** Never toast raw Supabase error text — it leaks
schema/constraint names. Use `authErrorMessage()` for auth errors and
`dbErrorMessage(err, fallback)` for DB errors. Pages reading data in
server components can rely on `(app)/error.tsx` for uncaught failures.

**Auth.** `@supabase/ssr` pattern: a browser client
(`src/lib/supabase/client.ts`) for client components and a server client
(`src/lib/supabase/server.ts`) for server components / route handlers.
The root `middleware.ts` refreshes sessions and redirects unauthed users
off protected routes. `safeNextPath()` validates redirect targets — use
it whenever you accept a `next` param from a URL.

**Multi-tenancy / RLS.**
- Every company-scoped table (`customers`, `service_locations`, `devices`,
  `test_results`) has `FOR ALL USING (company_id = public.user_company_id())`.
- `user_company_id()` is `SECURITY DEFINER STABLE` and reads the caller's
  tester row.
- Signup bypasses RLS exactly once via `public.create_company_and_first_tester`,
  a `SECURITY DEFINER` RPC with strict guards (auth.uid(), already-onboarded
  check, email pulled from `auth.users`). Grants only `authenticated`.
- **Never** add the Supabase service-role key to the app's env. If you
  need an admin-only write, write another `SECURITY DEFINER` RPC instead.

**Migrations.** Forward-only. Never edit an applied migration — add a new
one that alters. File name: `YYYYMMDDHHMMSS_short_snake_case.sql`. Apply
via the Supabase MCP or the SQL editor. After applying, regenerate
`src/lib/supabase/types.ts` from the dashboard and commit.

## Testing

Run `npm test` (vitest). Current coverage is unit-only:
- Zod schemas and helpers
- Auth / DB error mappers
- `safeNextPath()` open-redirect guard

**Still missing (priority order for future work):**
1. `pgTAP` or SQL-level tests for RLS policies
2. Trigger math: `update_device_last_tested` for all 4 due-date methods
3. Playwright e2e: signup → email confirm → onboarding → dashboard

## Deploy

Not yet set up. When it is, main pushes auto-deploy to Netlify prod;
preview deploys per PR. Supabase **Redirect URLs** must include
`http://localhost:3000/auth/callback` (dev) plus whatever Netlify assigns
for prod + deploy previews.

## Don't

- Don't import from `@/components/ui/*` into non-UI files and re-export —
  keep shadcn primitives at the leaves.
- Don't pass `asChild` to shadcn dropdown items; base-ui uses the
  `render={<element />}` prop pattern instead.
- Don't disable RLS to debug — write a superuser SQL query in the
  dashboard instead, and re-enable before leaving.
- Don't commit `.env.local`. `.gitignore` covers it; don't remove the
  `!.env.local.example` exception.
