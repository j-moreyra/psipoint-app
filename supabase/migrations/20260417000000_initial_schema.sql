-- BackFLO initial schema
-- 4-level hierarchy: Company -> Customer -> Service Location -> Device -> Test Result
-- Multi-tenant via RLS. Every non-companies table is scoped by company_id.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- companies (BackFLO tenant — the testing business)
-- ---------------------------------------------------------------------------
create table public.companies (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null,
  address_line_1                text,
  address_line_2                text,
  city                          text,
  state                         text check (state is null or length(state) = 2),
  zip                           text,
  phone                         text,
  website                       text,
  logo_url                      text,
  default_pdf_footer            text,
  next_due_calculation_method   text not null default 'test_date_plus_year'
    check (next_due_calculation_method in ('test_date_plus_year','anniversary','calendar_year_end','custom')),
  subscription_status           text not null default 'trial'
    check (subscription_status in ('trial','active','past_due','canceled')),
  trial_ends_at                 timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- testers (the app user — one per auth.users row)
-- ---------------------------------------------------------------------------
create table public.testers (
  id                          uuid primary key references auth.users(id) on delete cascade,
  company_id                  uuid not null references public.companies(id) on delete cascade,
  first_name                  text not null,
  last_name                   text not null,
  email                       text not null,
  phone                       text,
  license_number              text not null,
  license_expiration          date not null,
  license_issuing_authority   text,
  test_gauge_serial           text,
  test_gauge_calibration_date date,
  role                        text not null default 'owner'
    check (role in ('owner','admin','office','tester')),
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_testers_company on public.testers(company_id);
create trigger trg_testers_updated_at
  before update on public.testers
  for each row execute function public.set_updated_at();

-- Helper that returns the caller's company_id. Used by every RLS policy.
create or replace function public.user_company_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from public.testers where id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- customers (billing entity)
-- ---------------------------------------------------------------------------
create table public.customers (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,
  contact_first_name      text,
  contact_last_name       text,
  company_name            text,
  email                   text,
  phone                   text,
  billing_address_line_1  text,
  billing_address_line_2  text,
  billing_city            text,
  billing_state           text check (billing_state is null or length(billing_state) = 2),
  billing_zip             text,
  notes                   text,
  search_vector           tsvector generated always as (
    setweight(to_tsvector('english', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(contact_first_name, '') || ' ' || coalesce(contact_last_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '') || ' ' || coalesce(phone, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(billing_city, '') || ' ' || coalesce(billing_address_line_1, '')), 'D')
  ) stored,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint customers_name_required check (
    coalesce(company_name, contact_first_name, contact_last_name) is not null
  )
);

create index idx_customers_company on public.customers(company_id);
create index idx_customers_search on public.customers using gin(search_vector);
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_locations (physical properties)
-- ---------------------------------------------------------------------------
create table public.service_locations (
  id                            uuid primary key default gen_random_uuid(),
  customer_id                   uuid not null references public.customers(id) on delete cascade,
  company_id                    uuid not null references public.companies(id) on delete cascade,
  nickname                      text,
  address_line_1                text not null,
  address_line_2                text,
  city                          text not null,
  state                         text not null check (length(state) = 2),
  zip                           text not null,
  location_type                 text check (location_type in ('commercial','residential','industrial','irrigation','fire_line','other')),
  on_site_contact_first_name    text,
  on_site_contact_last_name     text,
  on_site_contact_phone         text,
  on_site_contact_email         text,
  water_district                text,
  access_notes                  text,
  hazard_type                   text check (hazard_type in ('low','high','unknown')),
  latitude                      numeric(10,7),
  longitude                     numeric(10,7),
  search_vector                 tsvector generated always as (
    setweight(to_tsvector('english', coalesce(nickname, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(address_line_1, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(on_site_contact_first_name, '') || ' ' ||
      coalesce(on_site_contact_last_name, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(water_district, '')), 'D')
  ) stored,
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index idx_service_locations_customer on public.service_locations(customer_id);
create index idx_service_locations_company on public.service_locations(company_id);
create index idx_service_locations_search on public.service_locations using gin(search_vector);
create trigger trg_service_locations_updated_at
  before update on public.service_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- devices (backflow prevention assemblies)
-- ---------------------------------------------------------------------------
create table public.devices (
  id                      uuid primary key default gen_random_uuid(),
  service_location_id     uuid not null references public.service_locations(id) on delete cascade,
  customer_id             uuid not null references public.customers(id) on delete cascade,
  company_id              uuid not null references public.companies(id) on delete cascade,
  serial_number           text not null,
  manufacturer            text not null,
  model                   text not null,
  size                    text not null,
  type                    text not null check (type in ('RP','DC','PVB','SVB','AVB')),
  location_description    text not null,
  install_date            date,
  service_type            text check (service_type in ('domestic','irrigation','fire_line','process_water','other')),
  last_tested_date        date,
  last_test_result        text check (last_test_result in ('pass','fail')),
  next_test_due_date      date,
  next_due_override       date,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint devices_unique_serial_per_location unique (company_id, service_location_id, serial_number)
);

create index idx_devices_service_location on public.devices(service_location_id);
create index idx_devices_customer on public.devices(customer_id);
create index idx_devices_company on public.devices(company_id);
create index idx_devices_serial_trgm on public.devices using gin(serial_number gin_trgm_ops);
create index idx_devices_next_test_due on public.devices(company_id, next_test_due_date) where is_active = true;
create trigger trg_devices_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- test_results (the core record)
-- ---------------------------------------------------------------------------
create table public.test_results (
  id                               uuid primary key default gen_random_uuid(),
  device_id                        uuid not null references public.devices(id) on delete cascade,
  service_location_id              uuid not null references public.service_locations(id) on delete cascade,
  customer_id                      uuid not null references public.customers(id) on delete cascade,
  tester_id                        uuid not null references public.testers(id),
  company_id                       uuid not null references public.companies(id) on delete cascade,
  test_date                        date not null,
  result                           text not null check (result in ('pass','fail')),
  check_valve_1_psid               numeric(4,1),
  check_valve_2_psid               numeric(4,1),
  relief_valve_opening             numeric(4,1),
  air_inlet_opening                numeric(4,1),
  shutoff_valve_1_condition        text,
  shutoff_valve_2_condition        text,
  test_gauge_serial                text not null,
  test_gauge_calibration_date      date,
  water_supply_pressure            numeric(4,1),
  repairs_made                     text,
  retest_result                    text check (retest_result in ('pass','fail')),
  retest_check_valve_1_psid        numeric(4,1),
  retest_check_valve_2_psid        numeric(4,1),
  retest_relief_valve_opening      numeric(4,1),
  retest_date                      date,
  notes                            text,
  review_status                    text not null default 'approved'
    check (review_status in ('draft','pending_review','approved','submitted')),
  reviewed_by                      uuid references public.testers(id),
  reviewed_at                      timestamptz,
  pdf_url                          text,
  emailed_at                       timestamptz,
  emailed_to                       text,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);

create index idx_test_results_device on public.test_results(device_id);
create index idx_test_results_service_location on public.test_results(service_location_id);
create index idx_test_results_customer on public.test_results(customer_id);
create index idx_test_results_company on public.test_results(company_id);
create index idx_test_results_date on public.test_results(test_date desc);
create trigger trg_test_results_updated_at
  before update on public.test_results
  for each row execute function public.set_updated_at();

-- Device last-tested fields get maintained from test_results, honouring
-- the company's configured next_due_calculation_method.
create or replace function public.update_device_last_tested()
returns trigger
language plpgsql
as $$
declare
  method text;
  calculated_due date;
begin
  select next_due_calculation_method into method
  from public.companies where id = new.company_id;

  calculated_due := case method
    when 'test_date_plus_year' then new.test_date + interval '1 year'
    when 'anniversary'        then (date_trunc('year', new.test_date) + interval '1 year')::date
    when 'calendar_year_end'  then (date_trunc('year', new.test_date) + interval '1 year 11 months')::date
    else new.test_date + interval '1 year'
  end;

  update public.devices
     set last_tested_date   = new.test_date,
         last_test_result   = coalesce(new.retest_result, new.result),
         next_test_due_date = calculated_due,
         updated_at         = now()
   where id = new.device_id
     and (last_tested_date is null or new.test_date >= last_tested_date);

  return new;
end;
$$;

create trigger trg_update_device_last_tested
  after insert on public.test_results
  for each row execute function public.update_device_last_tested();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.companies         enable row level security;
alter table public.testers           enable row level security;
alter table public.customers         enable row level security;
alter table public.service_locations enable row level security;
alter table public.devices           enable row level security;
alter table public.test_results      enable row level security;

-- companies: members of the company can read and update their own row.
-- Insert is handled during signup via a server action using the service role.
create policy "companies_select_own" on public.companies
  for select using (id = public.user_company_id());

create policy "companies_update_own" on public.companies
  for update using (id = public.user_company_id())
  with check (id = public.user_company_id());

-- testers: members of the same company can see each other. Self-update only.
create policy "testers_select_same_company" on public.testers
  for select using (company_id = public.user_company_id());

create policy "testers_update_self" on public.testers
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Company-scoped CRUD pattern for the remaining tables.
create policy "customers_company_isolation" on public.customers
  for all using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());

create policy "service_locations_company_isolation" on public.service_locations
  for all using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());

create policy "devices_company_isolation" on public.devices
  for all using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());

create policy "test_results_company_isolation" on public.test_results
  for all using (company_id = public.user_company_id())
  with check (company_id = public.user_company_id());
