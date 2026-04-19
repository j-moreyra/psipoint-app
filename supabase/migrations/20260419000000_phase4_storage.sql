-- Phase 4: Storage buckets for certificate PDFs and company logos.
--
-- Two private buckets, both scoped to the caller's company via a leading
-- path segment equal to public.user_company_id()::text. Reads use
-- short-lived signed URLs generated server-side — no public access.
--
-- Path conventions (enforced by the application layer):
--   certificates:   <company_id>/<test_result_id>.pdf
--   company-logos:  <company_id>/logo.<ext>
--
-- RLS policy template (same for both buckets, ×4 verbs = 8 policies):
--   (storage.foldername(name))[1] = public.user_company_id()::text
--
-- This leverages Supabase's storage.objects RLS; the authenticated role
-- already has grants on storage.objects by default. No service-role use
-- anywhere — matches the project's "no service-role in app env" rule.
-- If admin writes are ever needed, add a SECURITY DEFINER RPC instead.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- certificates — RLS
-- ---------------------------------------------------------------------------
create policy "certificates_select_own_company"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "certificates_insert_own_company"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "certificates_update_own_company"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  )
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "certificates_delete_own_company"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

-- ---------------------------------------------------------------------------
-- company-logos — RLS
-- ---------------------------------------------------------------------------
create policy "company_logos_select_own_company"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "company_logos_insert_own_company"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "company_logos_update_own_company"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  )
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );

create policy "company_logos_delete_own_company"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );
