# BackFLO MVP — Project Blueprint (v4)
### Backflow Prevention Testing Tracker

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase · Netlify · Resend · Stripe (later)
**AI Dev Model:** Claude Opus 4.7 (via Claude Code)
**Target User:** Solo backflow tester or small shop (1-5 techs)
**Core Loop:** Arrive → Find Device → Test → Generate PDF → Email Certificate → Next Job

---

## 1. POSITIONING & COMPETITIVE CONTEXT

### The incumbent: Syncta
Syncta is the market-leading backflow testing software, acquired by Watts Water Technologies in 2018. They start at $29/month and their core differentiator is a library of water purveyor-specific submission forms. They offer iOS, Android, and web apps, plus a customer-facing portal for scheduling and payments.

### Known Syncta weaknesses (BackFLO's wedge)
1. **UI quality degraded post-acquisition** — excessive pagination, missing back buttons, harder to find/edit data
2. **Rigid next-test-due-date logic** — doesn't match all utility calculation methods; forces manual overrides
3. **Multi-step forms lose data on back-navigation** — if you forget a field, you often delete and restart
4. **Corporate customer service** — ticket-based rather than the personal support testers prefer

### BackFLO's positioning
**"The modern alternative to Syncta. Built by a solo operator for solo operators."**

- Clean, fast UI — no excessive pagination, always-visible back navigation, no data loss on back
- Flexible due-date rules — support multiple utility calculation methods
- Transparent pricing — flat monthly fee, no sales calls required to sign up
- Personal onboarding — every customer gets a real person
- Unified search — find anything (customer, service location, device serial, phone) from one input

### Pricing
Tentative: **$39/month flat** (vs. Syncta's $29 base that expands with add-ons). Validate in discovery; adjust after initial cohort if needed. Free 14-day trial, no credit card required.

---

## 2. DATA MODEL — 4-LEVEL HIERARCHY

The critical architecture insight from studying Syncta: the industry operates on a **four-level hierarchy**, not three.

```
Company (BackFLO tenant — the testing business)
  └── Testers (employees — the app users)

Customer (billing entity — e.g., "Acme Property Management")
  └── Service Location (physical address — e.g., "Acme Building #3, 123 Oak St")
        └── Device (backflow assembly at that location)
              └── Test Result (one row per test event)
```

**Why Service Locations matter:**

- One customer can have many service locations (a property management firm manages 20 buildings)
- Each service location has its own address, contact person, gate code, water district, hazard type
- Devices belong to a service location, not directly to the customer
- Without this layer, you either duplicate customer records per building or cram many addresses into one record awkwardly

**Real-world example:**
```
Customer: Acme Property Management (billing goes here)
  ├── Service Location: Acme Tower — 123 Main St, Austin TX
  │     ├── Device: BF-001 (Watts 009, basement mech room)
  │     └── Device: BF-002 (Watts 860, irrigation line)
  ├── Service Location: Acme Warehouse — 456 Industrial Blvd, Austin TX
  │     └── Device: BF-003 (Febco 825Y, fire line)
  └── Service Location: Acme Retail Plaza — 789 Commerce Way, Round Rock TX
        ├── Device: BF-004 (Wilkins 975, domestic)
        └── Device: BF-005 (Wilkins 975, irrigation)
```

One customer, three service locations, five devices. The same test form with the same PDF format works for all of them.

---

## 3. DATABASE SCHEMA (Supabase / PostgreSQL)

### Design Principles
- **Multi-tenant from day one:** Every table is scoped to a `company_id` via RLS
- **Separate people from organizations:** Testers (people) linked to companies (orgs)
- **Four-level hierarchy:** Customer → Service Location → Device → Test Result
- **Explicit constraints:** NOT NULL, CHECK constraints, foreign keys at DB level
- **Denormalize hot-path fields:** `last_tested_date` on devices avoids expensive joins
- **Phone numbers and zip codes are `text`:** Numeric types break on formatting, leading zeros, extensions
- **Unified search via tsvector + pg_trgm:** Cross-table fast search

---

### Table: `companies` (the tester's business — the BackFLO tenant)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `name` | text | NOT NULL | Legal/trade name |
| `address_line_1` | text | | Street address |
| `address_line_2` | text | | Suite, unit |
| `city` | text | | |
| `state` | text | CHECK (length = 2) | Two-letter code |
| `zip` | text | | Text — preserves leading zeros |
| `phone` | text | | Text — preserves formatting |
| `website` | text | | |
| `logo_url` | text | | Supabase Storage; shown on PDF |
| `default_pdf_footer` | text | | Optional PDF customization |
| `next_due_calculation_method` | text | CHECK IN ('test_date_plus_year', 'anniversary', 'calendar_year_end', 'custom') | Flexibility Syncta lacks |
| `subscription_status` | text | CHECK IN ('trial', 'active', 'past_due', 'canceled') | For Stripe later |
| `trial_ends_at` | timestamptz | | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

### Table: `testers` (the person — the app user)

The `id` matches the Supabase auth user id. One tester belongs to one company (v1).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, FK → `auth.users(id)` | |
| `company_id` | uuid | FK → `companies(id)`, NOT NULL | |
| `first_name` | text | NOT NULL | |
| `last_name` | text | NOT NULL | |
| `email` | text | NOT NULL | Mirrors `auth.users.email` |
| `phone` | text | | Personal cell for field |
| `license_number` | text | NOT NULL | Required on every PDF |
| `license_expiration` | date | NOT NULL | Alert when approaching expiry |
| `license_issuing_authority` | text | | State/jurisdiction |
| `test_gauge_serial` | text | | Default gauge; pre-fills test forms |
| `test_gauge_calibration_date` | date | | Often required on cert |
| `role` | text | CHECK IN ('owner', 'admin', 'office', 'tester') | 'office' added — reviews tests, doesn't test |
| `is_active` | boolean | NOT NULL, default `true` | Soft delete |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

### Table: `customers` (billing entity)

The entity the tester invoices. May own many service locations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `company_id` | uuid | FK → `companies(id)`, NOT NULL | |
| `contact_first_name` | text | | |
| `contact_last_name` | text | | |
| `company_name` | text | | Property mgmt firm, owner name |
| `email` | text | | Where invoices and certs go by default |
| `phone` | text | | |
| `billing_address_line_1` | text | | May differ from service location address |
| `billing_address_line_2` | text | | |
| `billing_city` | text | | |
| `billing_state` | text | CHECK (length = 2) | |
| `billing_zip` | text | | |
| `notes` | text | | General notes about this customer |
| `search_vector` | tsvector | GENERATED | Unified search |
| `is_active` | boolean | NOT NULL, default `true` | Soft delete |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

**CHECK constraint:** At least one of `contact_first_name`, `contact_last_name`, or `company_name` is required.

```sql
-- Search vector includes billing address (useful for finding customers by their office)
ALTER TABLE customers ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(contact_first_name, '') || ' ' || coalesce(contact_last_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(email, '') || ' ' || coalesce(phone, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(billing_city, '') || ' ' || coalesce(billing_address_line_1, '')), 'D')
  ) STORED;

CREATE INDEX idx_customers_search ON customers USING GIN(search_vector);
```

### Table: `service_locations` (physical properties)

The actual buildings where devices live. This is the layer most searches hit (testers think in terms of addresses).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `customer_id` | uuid | FK → `customers(id)`, NOT NULL | |
| `company_id` | uuid | FK → `companies(id)`, NOT NULL | Denormalized for RLS |
| `nickname` | text | | "Acme Tower", "South Warehouse" — easier than address |
| `address_line_1` | text | NOT NULL | |
| `address_line_2` | text | | |
| `city` | text | NOT NULL | |
| `state` | text | NOT NULL, CHECK (length = 2) | |
| `zip` | text | NOT NULL | |
| `location_type` | text | CHECK IN ('commercial', 'residential', 'industrial', 'irrigation', 'fire_line', 'other') | For filtering/reporting |
| `on_site_contact_first_name` | text | | May differ from billing contact |
| `on_site_contact_last_name` | text | | |
| `on_site_contact_phone` | text | | |
| `on_site_contact_email` | text | | |
| `water_district` | text | | Which utility serves this property |
| `access_notes` | text | | "Gate code 4455", "Call 30 min before" |
| `hazard_type` | text | CHECK IN ('low', 'high', 'unknown') | Some jurisdictions require |
| `latitude` | numeric(10,7) | | For maps — geocoded on address save |
| `longitude` | numeric(10,7) | | |
| `search_vector` | tsvector | GENERATED | Unified search |
| `is_active` | boolean | NOT NULL, default `true` | Soft delete |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

```sql
ALTER TABLE service_locations ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(nickname, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(address_line_1, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(on_site_contact_first_name, '') || ' ' ||
      coalesce(on_site_contact_last_name, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(water_district, '')), 'D')
  ) STORED;

CREATE INDEX idx_service_locations_search ON service_locations USING GIN(search_vector);
```

### Table: `devices` (backflow prevention assemblies)

Physical devices at a service location.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `service_location_id` | uuid | FK → `service_locations(id)`, NOT NULL | **Note: changed from customer_id** |
| `customer_id` | uuid | FK → `customers(id)`, NOT NULL | Denormalized for fast queries |
| `company_id` | uuid | FK → `companies(id)`, NOT NULL | Denormalized for RLS |
| `serial_number` | text | NOT NULL | Physical serial on device |
| `manufacturer` | text | NOT NULL | Watts, Wilkins, Febco, Apollo, Zurn |
| `model` | text | NOT NULL | e.g., "009", "860", "LF860U" |
| `size` | text | NOT NULL | e.g., "3/4\"", "1\"", "2\"" |
| `type` | text | NOT NULL, CHECK IN ('RP', 'DC', 'PVB', 'SVB', 'AVB') | |
| `location_description` | text | NOT NULL | "Basement mech room", "Irrigation box S side" |
| `install_date` | date | | |
| `service_type` | text | CHECK IN ('domestic', 'irrigation', 'fire_line', 'process_water', 'other') | What the device protects |
| `last_tested_date` | date | | Denormalized from most recent test |
| `last_test_result` | text | CHECK IN ('pass', 'fail', null) | Denormalized |
| `next_test_due_date` | date | | Calculated per company's `next_due_calculation_method` |
| `next_due_override` | date | | Manual override for utility-specific rules |
| `is_active` | boolean | NOT NULL, default `true` | Devices get replaced, not deleted |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

**UNIQUE constraint:** `(company_id, service_location_id, serial_number)` — prevents duplicate devices at the same location.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_devices_serial_trgm ON devices USING GIN(serial_number gin_trgm_ops);
CREATE INDEX idx_devices_next_test_due ON devices(company_id, next_test_due_date) WHERE is_active = true;
```

### Table: `test_results` (the core record)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `device_id` | uuid | FK → `devices(id)`, NOT NULL | |
| `service_location_id` | uuid | FK → `service_locations(id)`, NOT NULL | Denormalized |
| `customer_id` | uuid | FK → `customers(id)`, NOT NULL | Denormalized |
| `tester_id` | uuid | FK → `testers(id)`, NOT NULL | |
| `company_id` | uuid | FK → `companies(id)`, NOT NULL | For RLS |
| `test_date` | date | NOT NULL | |
| `result` | text | NOT NULL, CHECK IN ('pass', 'fail') | Initial test result |
| `check_valve_1_psid` | numeric(4,1) | | |
| `check_valve_2_psid` | numeric(4,1) | | |
| `relief_valve_opening` | numeric(4,1) | | RP only |
| `air_inlet_opening` | numeric(4,1) | | PVB only |
| `shutoff_valve_1_condition` | text | | "Closed tight", "Leaking" |
| `shutoff_valve_2_condition` | text | | |
| `test_gauge_serial` | text | NOT NULL | |
| `test_gauge_calibration_date` | date | | |
| `water_supply_pressure` | numeric(4,1) | | Line pressure at test time |
| `repairs_made` | text | | If device failed initially |
| `retest_result` | text | CHECK IN ('pass', 'fail', null) | |
| `retest_check_valve_1_psid` | numeric(4,1) | | |
| `retest_check_valve_2_psid` | numeric(4,1) | | |
| `retest_relief_valve_opening` | numeric(4,1) | | |
| `retest_date` | date | | |
| `notes` | text | | |
| `review_status` | text | CHECK IN ('draft', 'pending_review', 'approved', 'submitted') | Office can review before sending |
| `reviewed_by` | uuid | FK → `testers(id)` | Who approved |
| `reviewed_at` | timestamptz | | |
| `pdf_url` | text | | Supabase Storage URL |
| `emailed_at` | timestamptz | | |
| `emailed_to` | text | | |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()` | |

**Note:** For v1 solo testers, `review_status` defaults to `'approved'` on save (no review needed). The field exists so v2 multi-tester shops can add the review workflow without migration.

---

### Row Level Security (RLS)

All tables company-scoped via the helper function:

```sql
CREATE FUNCTION auth.user_company_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT company_id FROM testers WHERE id = auth.uid() LIMIT 1;
$$;

-- Policy pattern repeated for each table
CREATE POLICY "company_isolation" ON customers FOR ALL
  USING (company_id = auth.user_company_id())
  WITH CHECK (company_id = auth.user_company_id());

-- Same pattern for service_locations, devices, test_results
-- Testers table: members of same company can see each other (for admin role selection)
-- Companies table: own company only
```

### Triggers

```sql
-- Update device's last_tested fields when test is recorded
-- Respects company's configured next_due_calculation_method
CREATE FUNCTION update_device_last_tested() RETURNS trigger AS $$
DECLARE
  method text;
  calculated_due date;
BEGIN
  SELECT next_due_calculation_method INTO method
  FROM companies WHERE id = NEW.company_id;

  calculated_due := CASE method
    WHEN 'test_date_plus_year' THEN NEW.test_date + INTERVAL '1 year'
    WHEN 'anniversary' THEN
      DATE_TRUNC('year', NEW.test_date) + INTERVAL '1 year'
    WHEN 'calendar_year_end' THEN
      (DATE_TRUNC('year', NEW.test_date) + INTERVAL '1 year 11 months')::date
    ELSE NEW.test_date + INTERVAL '1 year'
  END;

  UPDATE devices
  SET
    last_tested_date = NEW.test_date,
    last_test_result = COALESCE(NEW.retest_result, NEW.result),
    next_test_due_date = calculated_due,
    updated_at = now()
  WHERE id = NEW.device_id
    AND (last_tested_date IS NULL OR NEW.test_date >= last_tested_date);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_device_last_tested
  AFTER INSERT ON test_results
  FOR EACH ROW EXECUTE FUNCTION update_device_last_tested();

-- Standard updated_at trigger applied to all tables (see v3)
```

### Key Indexes

```sql
-- Hierarchy traversal
CREATE INDEX idx_service_locations_customer ON service_locations(customer_id);
CREATE INDEX idx_service_locations_company ON service_locations(company_id);
CREATE INDEX idx_devices_service_location ON devices(service_location_id);
CREATE INDEX idx_devices_customer ON devices(customer_id);
CREATE INDEX idx_devices_company ON devices(company_id);
CREATE INDEX idx_test_results_device ON test_results(device_id);
CREATE INDEX idx_test_results_service_location ON test_results(service_location_id);
CREATE INDEX idx_test_results_customer ON test_results(customer_id);
CREATE INDEX idx_test_results_company ON test_results(company_id);
CREATE INDEX idx_test_results_date ON test_results(test_date DESC);

-- Search (already created above):
-- idx_customers_search (GIN tsvector)
-- idx_service_locations_search (GIN tsvector)
-- idx_devices_serial_trgm (GIN trigram)

-- Due-date dashboards
CREATE INDEX idx_devices_next_test_due ON devices(company_id, next_test_due_date) WHERE is_active = true;
```

---

## 4. UNIFIED SEARCH (updated for 4-level hierarchy)

The search now covers three object types: customers, service locations, and devices.

### What the search covers
- **Customers:** contact name, company name, email, phone, billing city
- **Service locations:** nickname, address, city, on-site contact, water district
- **Devices:** serial number (fuzzy)

### Implementation

```typescript
async function unifiedSearch(query: string, companyId: string) {
  const [customers, locations, devices] = await Promise.all([
    supabase.from('customers')
      .select('id, company_name, contact_first_name, contact_last_name, billing_city')
      .eq('company_id', companyId)
      .textSearch('search_vector', query, { type: 'websearch' })
      .limit(5),

    supabase.from('service_locations')
      .select('id, nickname, address_line_1, city, customer_id, customers(company_name)')
      .eq('company_id', companyId)
      .textSearch('search_vector', query, { type: 'websearch' })
      .limit(10),

    supabase.from('devices')
      .select(`
        id, serial_number, manufacturer, model,
        service_location_id, service_locations(nickname, address_line_1, customers(company_name))
      `)
      .eq('company_id', companyId)
      .ilike('serial_number', `%${query}%`)
      .limit(10),
  ]);

  return {
    customers: customers.data ?? [],
    serviceLocations: locations.data ?? [],
    devices: devices.data ?? [],
  };
}
```

### Search result UI (three grouped sections)

```
┌────────────────────────────────────────────┐
│  🔍 acme                                    │
├────────────────────────────────────────────┤
│  CUSTOMERS (1)                              │
│  • Acme Property Management                 │
│    Austin, TX                               │
│                                             │
│  SERVICE LOCATIONS (3)                      │
│  • Acme Tower                               │
│    123 Main St, Austin TX                   │
│    (Acme Property Management)               │
│  • Acme Warehouse                           │
│    456 Industrial Blvd, Austin TX           │
│  • Acme Retail Plaza                        │
│    789 Commerce Way, Round Rock TX          │
│                                             │
│  DEVICES (0)                                │
└────────────────────────────────────────────┘
```

Tapping a service location → location detail. Tapping a device → device detail. Each row has a quick "Start Test" shortcut for testers already at that location.

---

## 5. SCREENS & USER FLOWS

### Screen map (4-level hierarchy drives navigation)

```
Auth (Login / Signup)
  │
  └── First signup onboarding
        ├── Step 1: Create company (name, address, due-date method)
        ├── Step 2: Complete tester profile (name, license, gauge)
        └── Step 3: Welcome → Dashboard
  │
  ├── Dashboard
  │     ├── Unified search bar (customers + locations + devices)
  │     ├── "Devices Due Soon" (next 30 days with service location context)
  │     ├── "Overdue Devices" alert
  │     ├── Recent tests (last 10)
  │     └── "New Test" primary action
  │
  ├── Customers
  │     ├── List (searchable, sortable)
  │     ├── Detail
  │     │     ├── Billing info
  │     │     ├── Service Locations list (this is the key view)
  │     │     └── Recent tests across all locations
  │     └── Add/Edit form
  │
  ├── Service Locations (accessed via Customer Detail)
  │     ├── Detail
  │     │     ├── Address + contact + water district + access notes
  │     │     ├── Devices list (with status indicators)
  │     │     └── Test history at this location
  │     └── Add/Edit form
  │
  ├── Devices (accessed via Service Location)
  │     ├── Detail (specs + full test history + due date)
  │     └── Add/Edit form
  │
  ├── New Test (the money screen)
  │     ├── Step 1: Customer OR serial-number direct-entry
  │     ├── Step 2: Service Location (if not coming from serial)
  │     ├── Step 3: Device
  │     ├── Step 4: Test entry form (type-aware)
  │     └── Step 5: Review → Generate → Email
  │
  ├── Test Result / PDF
  │     └── Preview, download, email
  │
  └── Settings
        ├── My Profile (tester: name, license, gauge)
        ├── Company (name, address, logo, PDF customization, due-date method)
        └── Account (email, password, billing — post-MVP)
```

### Critical flow: New Test Entry (updated for hierarchy)

```
Step 1: ENTRY POINT
  └── Option A: Search customer name → shows their service locations
  └── Option B: Scan/type device serial → jumps straight to the device
  └── Inline "Add Customer" if new

Step 2: SERVICE LOCATION (skipped if entered by serial)
  └── Shows all service locations for this customer
  └── Each shows address, device count, next device due date
  └── Inline "Add Service Location"

Step 3: DEVICE
  └── All devices at this location with status indicators:
      ⚠️ overdue, 🔜 due soon, ✅ current, 🆕 never tested
  └── Inline "Add Device"

Step 4: TEST DATA (form adapts to device type)
  ├── Auto-filled: tester, license, date, gauge, device serial/make/model,
  │    service location, customer name
  ├── Manual entry (RP example): CV1 PSID, CV2 PSID, Relief Valve Opening,
  │    shutoff valve conditions, pass/fail, notes
  └── If FAIL: repairs description, retest readings, retest pass/fail

Step 5: REVIEW & GENERATE
  └── Summary screen
  └── "Generate Certificate" → PDF preview
  └── Email to customer — pre-fills customer billing email OR
      on-site contact email (user chooses)
  └── "Save & Done"
```

**Design principle (counters Syncta):** Every screen has a visible back button. Every multi-step form preserves data when navigating back. No destructive back-navigation.

---

## 6. PDF CERTIFICATE

Certificate now includes both billing customer and service location context:

```
┌────────────────────────────────────────────┐
│  [Company Logo]  BACKFLOW PREVENTION        │
│  [Company Name]  ASSEMBLY TEST REPORT       │
│  [Address, Phone, Website]                  │
├────────────────────────────────────────────┤
│  CUSTOMER (Billing)                         │
│  Contact: ________  Phone: ________         │
│  Company: ________                          │
│  Billing Address: __________________________│
├────────────────────────────────────────────┤
│  SERVICE LOCATION                           │
│  Nickname: ________                         │
│  Address: __________________________________│
│  On-site Contact: ________  Phone: ________ │
│  Water District: ________                   │
│  Hazard: ☐ Low  ☐ High                      │
├────────────────────────────────────────────┤
│  DEVICE                                     │
│  Serial #: ________  Mfr: ________          │
│  Model: ________  Size: ________            │
│  Type: ☑ RP  ☐ DC  ☐ PVB  ☐ SVB  ☐ AVB     │
│  Location on-site: ____________________     │
├────────────────────────────────────────────┤
│  TEST RESULTS                               │
│  [readings, pass/fail, etc.]                │
├────────────────────────────────────────────┤
│  [Fail section if applicable]               │
├────────────────────────────────────────────┤
│  CERTIFICATION                              │
│  Tester, license, gauge, date, signature    │
├────────────────────────────────────────────┤
│  Generated by BackFLO · backflo.app         │
└────────────────────────────────────────────┘
```

**Technical approach:** `@react-pdf/renderer` — unchanged from v3.

---

## 7. BUILD ORDER (Phased — Claude 4.7)

Target: shippable v1 in ~3.5 weeks. Adding Service Locations costs 2-3 days but is far cheaper now than retrofitting later.

### Phase 1: Foundation (Days 1-3)
- Next.js 15, TypeScript, App Router
- Install: Tailwind, shadcn/ui, Zod, react-hook-form, Supabase SDK
- Supabase migration: 6 tables + RLS + triggers + indexes + search vectors
- Netlify deploy (env vars)
- Auth flow (signup, login, logout, password reset)
- Onboarding flow (create company → tester profile → welcome)
- App shell (mobile-first nav with persistent back button)
- Settings → My Profile and Company screens

**Milestone:** Sign up, create company, fill profile, deploy live.

### Phase 2: Customer → Service Location → Device Management (Days 4-9)
- Customer list + detail + add/edit form
- Service Locations list (on Customer Detail) + detail + add/edit form
- Devices list (on Service Location Detail) + detail + add/edit form
- Device form is type-aware (RP/DC/PVB/SVB/AVB show different fields)
- Address geocoding on service location save (free via Nominatim or paid via Google)
- Seed script with realistic hierarchical data

**Milestone:** Build a realistic dataset (5 customers, 15 service locations, 40 devices) and navigate it fluidly on mobile.

### Phase 3: Unified Search + Test Entry (Days 10-15)
- Unified search bar in app header (3 object types)
- Search result UI with grouped sections + "Start Test" shortcut
- "New Test" multi-step flow
  - Entry points: by customer or by device serial
  - Service Location select (skipped if entering by serial)
  - Device select with status indicators
  - Test entry form with conditional fields
  - Smart defaults everywhere
- Save test_result → trigger updates device automatically
- Test history on Device, Service Location, Customer detail screens
- Dashboard "Recent Tests" and "Due Soon" lists

**Milestone:** Sub-2-minute test recording on a phone.

### Phase 4: PDF Generation & Email (Days 16-20)
- PDF certificate component with @react-pdf/renderer
- Handle all device-type variants
- Include company logo from Supabase Storage
- "Generate Certificate" flow: render → upload to Storage → save pdf_url
- PDF preview screen with download
- Resend integration for transactional email
- "Email to..." with choice of billing email vs. on-site contact email
- Record `emailed_at`, `emailed_to`

**Milestone:** Complete capture → PDF → email loop.

### Phase 5: Polish & Field-Readiness (Days 21-24)
- Mobile-responsive QA on real iPhone + Android
- Empty states, loading states, success toasts
- Error boundaries
- PWA manifest + service worker (installable)
- Local form state persistence (don't lose half-filled test forms)
- Optimistic UI updates where safe
- Dashboard "Overdue Devices" prominence
- License expiration warnings (30/60/90 days)
- Due-date calculation method setting in Company settings

**Milestone:** Ready for paying customer #1.

---

## 8. WHAT'S OUT (v2+)

| Feature | Why deferred | Build trigger |
|---------|--------------|---------------|
| **Public Test Request URL** (customers book without login) | Killer feature — Syncta has this | After 5+ testers paying |
| Customer Portal (login, view history, pay) | Two-sided UX work | 20+ testers onboarded |
| Multi-tester invites + test review workflow | v1 users are solo | First shop with 2+ techs |
| Invoicing | Testers use Square/Stripe links | 3+ customers ask |
| Utility Submission Integration | ~3,000 utilities, extreme fragmentation | Deep territory penetration |
| Parent/Child customers (franchises) | Not common at solo-tester scale | First franchise operator |
| Scheduling / calendar | Not core to capture loop | Route planning requests |
| Full offline sync | Local state may be enough | Field testers validate need |
| Bulk import | Manual fine early | 500+ device migration request |
| QuickBooks integration | Big feature, big scope | Invoicing built first |
| Google Maps route optimization | Nice-to-have | After core value proven |
| Stripe billing UI | Manual trial → invoice first | Before ~10 customers |
| Digital PDF signatures | Some jurisdictions require | Field feedback |

---

## 9. KEY RISKS & MITIGATIONS

| Risk | Mitigation |
|------|------------|
| Paper forms vary by jurisdiction | Flexible form with all common fields |
| Testers won't switch from paper | Sub-2-minute test recording, PDF better than paper |
| Syncta is "good enough" for most | Compete on UX quality, transparent pricing, flexible due-dates |
| Field connectivity | v1: local state persistence. v2: full offline sync |
| PDF format varies by utility | v1: clean generic template. v2: configurable per territory |
| 4-level hierarchy feels complex to simple testers | UX can hide complexity — solo tester with one property at one address never sees the Service Location layer as a separate step (form folds it into Customer creation) |
| Single-tester model limits growth | Schema is multi-tenant from day one |
| Watts/Syncta responds competitively | Move faster; stay close to customers; build features Watts won't |
| Domain / trademark on "BackFLO" | Verify before Phase 1 |

**UX note on hiding hierarchy complexity:**
For a solo tester with a simple setup — one property owner at one address — the "Add Customer" form should have an inline toggle: *"Is the billing address the same as the service address?"* If yes, it creates the customer AND the service location in one step. The hierarchy is there under the hood but invisible in the common case. Only when a tester has to manage multi-location customers does the hierarchy become visible.

---

## 10. CLAUDE 4.7 DEV TIPS

- **Model string:** `claude-opus-4-7`
- Reference this blueprint and specific phases in prompts
- Request TypeScript strict mode
- Request Zod schemas alongside every form
- Request tests for non-trivial logic (due-date trigger, type-aware device forms, hierarchical search)
- Let Claude 4.7 refactor aggressively — it maintains consistency across large codebases
- Build a seed script early (Phase 2) so every feature has realistic hierarchical data to test against

---

## 11. SUCCESS METRICS

**Before launch (validation):**
- 5+ testers agree to try free beta
- 1 design partner committed to weekly feedback

**Launch traction (first 60 days):**
- 10 testers actively logging tests weekly
- PDF generation used on 80%+ of tests
- Email delivery used on 50%+ of tests
- 3+ testers say "I stopped using paper" unprompted
- 1+ tester says "I left Syncta for BackFLO"

**Revenue target (6 months):**
- 50 paying customers × $39/month = ~$23K ARR
- Path to 100 customers visible via word-of-mouth + one utility territory foothold

---

## 12. CHANGELOG: v3 → v4

| Change | Why |
|--------|-----|
| Added `service_locations` table between customers and devices | Matches how the industry actually works; one customer can manage many properties |
| Moved service-location-specific fields off customer (address fields split into billing vs service) | Billing address and service address are genuinely different |
| Added on-site contact fields to service_locations | The person at the building ≠ the person who pays |
| Added `water_district` and `hazard_type` to service_locations | Jurisdictional requirements; sets up utility-per-property integrations later |
| Added `latitude`/`longitude` to service_locations | Enables maps view in v2 without migration |
| Added `location_type` enum (commercial/residential/industrial/irrigation/fire_line) | Filtering/reporting, matches Syncta |
| Added `nickname` to service_locations | Easier to reference than addresses |
| Added `review_status` + `reviewed_by`/`reviewed_at` to test_results | Supports v2 multi-tester review workflow without future migration |
| Added `service_type` to devices (domestic/irrigation/fire_line/etc.) | Useful filter; distinguishes purpose of each device |
| Denormalized `customer_id` on devices and test_results | Fast "all devices for this customer" queries |
| Added 'office' to tester role enum | Syncta has Admin/Office/Technician — common industry pattern |
| Search now covers 3 object types (customer, location, device) | Testers search by any of these |
| Test entry flow: added "enter by serial number" path | Tester at a device doesn't need to navigate the hierarchy |
| PDF layout: splits Customer and Service Location sections | Accurate representation of the two entities |
| UX note: inline "billing same as service address" toggle | Hides hierarchy for simple cases |
