-- Signup RPC: atomically create a company + first tester row.
-- Called from the onboarding flow after supabase.auth.signUp().
-- SECURITY DEFINER so it can insert the company row before the caller
-- has any tester row (and therefore before RLS would otherwise allow it).

create or replace function public.create_company_and_first_tester(
  -- required
  p_company_name                 text,
  p_first_name                   text,
  p_last_name                    text,
  p_license_number               text,
  p_license_expiration           date,
  -- optional company
  p_company_address_line_1       text default null,
  p_company_address_line_2       text default null,
  p_company_city                 text default null,
  p_company_state                text default null,
  p_company_zip                  text default null,
  p_company_phone                text default null,
  p_company_website              text default null,
  p_next_due_calculation_method  text default 'test_date_plus_year',
  -- optional tester
  p_tester_phone                 text default null,
  p_license_issuing_authority    text default null,
  p_test_gauge_serial            text default null,
  p_test_gauge_calibration_date  date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id     uuid := auth.uid();
  v_user_email  text;
  v_company_id  uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.testers where id = v_user_id) then
    raise exception 'already onboarded' using errcode = '23505';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    raise exception 'user email not found' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_company_name), '') = '' then
    raise exception 'company name is required' using errcode = '23514';
  end if;
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    raise exception 'first and last name are required' using errcode = '23514';
  end if;
  if coalesce(btrim(p_license_number), '') = '' then
    raise exception 'license number is required' using errcode = '23514';
  end if;

  insert into public.companies (
    name,
    address_line_1, address_line_2, city, state, zip, phone, website,
    next_due_calculation_method,
    subscription_status,
    trial_ends_at
  ) values (
    btrim(p_company_name),
    p_company_address_line_1,
    p_company_address_line_2,
    p_company_city,
    upper(nullif(btrim(p_company_state), '')),
    p_company_zip,
    p_company_phone,
    p_company_website,
    coalesce(p_next_due_calculation_method, 'test_date_plus_year'),
    'trial',
    now() + interval '14 days'
  )
  returning id into v_company_id;

  insert into public.testers (
    id, company_id,
    first_name, last_name, email, phone,
    license_number, license_expiration, license_issuing_authority,
    test_gauge_serial, test_gauge_calibration_date,
    role
  ) values (
    v_user_id,
    v_company_id,
    btrim(p_first_name),
    btrim(p_last_name),
    v_user_email,
    p_tester_phone,
    btrim(p_license_number),
    p_license_expiration,
    p_license_issuing_authority,
    p_test_gauge_serial,
    p_test_gauge_calibration_date,
    'owner'
  );

  return v_company_id;
end;
$$;

-- Lock down execution: only authenticated users, never anon/public.
revoke all on function public.create_company_and_first_tester(
  text, text, text, text, date,
  text, text, text, text, text, text, text, text,
  text, text, text, date
) from public;

revoke all on function public.create_company_and_first_tester(
  text, text, text, text, date,
  text, text, text, text, text, text, text, text,
  text, text, text, date
) from anon;

grant execute on function public.create_company_and_first_tester(
  text, text, text, text, date,
  text, text, text, text, text, text, text, text,
  text, text, text, date
) to authenticated;
