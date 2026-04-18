-- Atomic customer + first service-location insert for the "billing =
-- service" shortcut on the new-customer form. Two separate .insert()
-- calls from the client can orphan a customer row if the second fails;
-- wrapping them in a single PL/pgSQL function inside PostgREST's
-- per-request transaction gives us the all-or-nothing we need.
--
-- SECURITY INVOKER (the default) — the caller already has INSERT rights
-- on both tables via RLS; we don't need to escalate, we just need the
-- atomicity.  Still stamps company_id from user_company_id() rather
-- than trusting a parameter so a forged or spoofed company_id can't
-- slip through.

create or replace function public.create_customer_with_location(
  -- customer fields (all optional; DB check enforces "at least one name")
  p_contact_first_name      text default null,
  p_contact_last_name       text default null,
  p_company_name            text default null,
  p_email                   text default null,
  p_phone                   text default null,
  p_billing_address_line_1  text default null,
  p_billing_address_line_2  text default null,
  p_billing_city            text default null,
  p_billing_state           text default null,
  p_billing_zip             text default null,
  p_notes                   text default null,
  -- service-location extras (address mirrors billing_*; required on svc_loc)
  p_location_nickname       text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id  uuid;
  v_customer_id uuid;
begin
  v_company_id := public.user_company_id();
  if v_company_id is null then
    raise exception 'no company for caller' using errcode = '28000';
  end if;

  -- Billing-address fields are required on service_locations (NOT NULL
  -- in DB). Guard client-side too, but enforce here so a bad caller
  -- gets a clean 400 instead of a confusing NOT-NULL violation.
  if coalesce(btrim(p_billing_address_line_1), '') = ''
     or coalesce(btrim(p_billing_city), '') = ''
     or coalesce(btrim(p_billing_state), '') = ''
     or coalesce(btrim(p_billing_zip), '') = '' then
    raise exception 'billing address fields required for service location'
      using errcode = '23514';
  end if;

  insert into public.customers (
    company_id,
    contact_first_name, contact_last_name, company_name,
    email, phone,
    billing_address_line_1, billing_address_line_2,
    billing_city, billing_state, billing_zip,
    notes
  ) values (
    v_company_id,
    nullif(btrim(p_contact_first_name), ''),
    nullif(btrim(p_contact_last_name), ''),
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_billing_address_line_1), ''),
    nullif(btrim(p_billing_address_line_2), ''),
    nullif(btrim(p_billing_city), ''),
    upper(nullif(btrim(p_billing_state), '')),
    nullif(btrim(p_billing_zip), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into v_customer_id;

  insert into public.service_locations (
    company_id, customer_id,
    nickname,
    address_line_1, address_line_2,
    city, state, zip
  ) values (
    v_company_id, v_customer_id,
    nullif(btrim(p_location_nickname), ''),
    btrim(p_billing_address_line_1),
    nullif(btrim(p_billing_address_line_2), ''),
    btrim(p_billing_city),
    upper(btrim(p_billing_state)),
    btrim(p_billing_zip)
  );

  return v_customer_id;
end;
$$;

revoke all on function public.create_customer_with_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public;

revoke all on function public.create_customer_with_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) from anon;

grant execute on function public.create_customer_with_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
