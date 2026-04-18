-- Phase 3: fuzzy serial-number device search for the unified search bar.
-- Backs the Phase 3 decision (Q3) to use pg_trgm similarity() from day one
-- instead of ilike %q%. Serial numbers are field-typed and mistyped often;
-- similarity scoring gives stable ranking as the device set grows.
--
-- Uses the existing idx_devices_serial_trgm GIN index (initial schema) via
-- the % operator. The caller-supplied threshold acts as a floor ON TOP of
-- the default pg_trgm.similarity_threshold GUC (0.3), so passing
-- p_threshold < 0.3 still filters at 0.3. Keeping % in the WHERE clause
-- makes the query index-backed at O(log n) instead of a seq scan. Tune
-- upward from 0.3 for stricter matching; to go looser, adjust the GUC or
-- drop the % predicate and accept the seq scan.
--
-- SECURITY INVOKER: RLS on devices, service_locations, and customers
-- filters everything to the caller's company. No privilege escalation —
-- the function is just a typed, indexed entry point for the client.

create or replace function public.search_devices_by_serial(
  p_query     text,
  p_threshold real default 0.3,
  p_limit     int  default 10
)
returns table (
  device_id                         uuid,
  serial_number                     text,
  manufacturer                      text,
  model                             text,
  type                              text,
  is_active                         boolean,
  service_location_id               uuid,
  service_location_nickname         text,
  service_location_address_line_1   text,
  service_location_city             text,
  customer_id                       uuid,
  customer_company_name             text,
  customer_contact_first_name       text,
  customer_contact_last_name        text,
  similarity_score                  real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id,
    d.serial_number,
    d.manufacturer,
    d.model,
    d.type,
    d.is_active,
    sl.id,
    sl.nickname,
    sl.address_line_1,
    sl.city,
    c.id,
    c.company_name,
    c.contact_first_name,
    c.contact_last_name,
    similarity(d.serial_number, p_query)
  from public.devices d
    join public.service_locations sl on sl.id = d.service_location_id
    join public.customers         c  on c.id  = d.customer_id
  where d.is_active
    and length(btrim(p_query)) >= 3
    and d.serial_number % p_query
    and similarity(d.serial_number, p_query) >= coalesce(p_threshold, 0.3)
  order by similarity(d.serial_number, p_query) desc, d.serial_number asc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

revoke all on function public.search_devices_by_serial(text, real, int) from public;
revoke all on function public.search_devices_by_serial(text, real, int) from anon;
grant execute on function public.search_devices_by_serial(text, real, int) to authenticated;
