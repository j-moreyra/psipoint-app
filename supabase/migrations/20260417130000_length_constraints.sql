-- Caps on user-supplied text columns. Prevents trivial DoS via a
-- megabyte-sized company name and keeps renderer / PDF / search index
-- budgets predictable. Using char_length (not length/octet_length) so
-- the caps reflect visible characters across Unicode.

-- companies
alter table public.companies
  add constraint companies_name_len check (char_length(name) <= 200),
  add constraint companies_address1_len check (char_length(coalesce(address_line_1, '')) <= 200),
  add constraint companies_address2_len check (char_length(coalesce(address_line_2, '')) <= 200),
  add constraint companies_city_len check (char_length(coalesce(city, '')) <= 100),
  add constraint companies_zip_len check (char_length(coalesce(zip, '')) <= 20),
  add constraint companies_phone_len check (char_length(coalesce(phone, '')) <= 50),
  add constraint companies_website_len check (char_length(coalesce(website, '')) <= 500),
  add constraint companies_pdf_footer_len check (char_length(coalesce(default_pdf_footer, '')) <= 500);

-- testers
alter table public.testers
  add constraint testers_first_name_len check (char_length(first_name) <= 100),
  add constraint testers_last_name_len check (char_length(last_name) <= 100),
  add constraint testers_email_len check (char_length(email) <= 255),
  add constraint testers_phone_len check (char_length(coalesce(phone, '')) <= 50),
  add constraint testers_license_number_len check (char_length(license_number) <= 100),
  add constraint testers_license_issuer_len check (char_length(coalesce(license_issuing_authority, '')) <= 200),
  add constraint testers_gauge_serial_len check (char_length(coalesce(test_gauge_serial, '')) <= 100);

-- customers
alter table public.customers
  add constraint customers_contact_first_len check (char_length(coalesce(contact_first_name, '')) <= 100),
  add constraint customers_contact_last_len check (char_length(coalesce(contact_last_name, '')) <= 100),
  add constraint customers_company_name_len check (char_length(coalesce(company_name, '')) <= 200),
  add constraint customers_email_len check (char_length(coalesce(email, '')) <= 255),
  add constraint customers_phone_len check (char_length(coalesce(phone, '')) <= 50),
  add constraint customers_billing_addr1_len check (char_length(coalesce(billing_address_line_1, '')) <= 200),
  add constraint customers_billing_addr2_len check (char_length(coalesce(billing_address_line_2, '')) <= 200),
  add constraint customers_billing_city_len check (char_length(coalesce(billing_city, '')) <= 100),
  add constraint customers_billing_zip_len check (char_length(coalesce(billing_zip, '')) <= 20),
  add constraint customers_notes_len check (char_length(coalesce(notes, '')) <= 5000);

-- service_locations
alter table public.service_locations
  add constraint svc_loc_nickname_len check (char_length(coalesce(nickname, '')) <= 200),
  add constraint svc_loc_addr1_len check (char_length(address_line_1) <= 200),
  add constraint svc_loc_addr2_len check (char_length(coalesce(address_line_2, '')) <= 200),
  add constraint svc_loc_city_len check (char_length(city) <= 100),
  add constraint svc_loc_zip_len check (char_length(zip) <= 20),
  add constraint svc_loc_contact_first_len check (char_length(coalesce(on_site_contact_first_name, '')) <= 100),
  add constraint svc_loc_contact_last_len check (char_length(coalesce(on_site_contact_last_name, '')) <= 100),
  add constraint svc_loc_contact_phone_len check (char_length(coalesce(on_site_contact_phone, '')) <= 50),
  add constraint svc_loc_contact_email_len check (char_length(coalesce(on_site_contact_email, '')) <= 255),
  add constraint svc_loc_water_district_len check (char_length(coalesce(water_district, '')) <= 200),
  add constraint svc_loc_access_notes_len check (char_length(coalesce(access_notes, '')) <= 2000);

-- devices
alter table public.devices
  add constraint devices_serial_len check (char_length(serial_number) <= 100),
  add constraint devices_manufacturer_len check (char_length(manufacturer) <= 100),
  add constraint devices_model_len check (char_length(model) <= 100),
  add constraint devices_size_len check (char_length(size) <= 50),
  add constraint devices_location_desc_len check (char_length(location_description) <= 500);

-- test_results
alter table public.test_results
  add constraint tr_shutoff1_len check (char_length(coalesce(shutoff_valve_1_condition, '')) <= 200),
  add constraint tr_shutoff2_len check (char_length(coalesce(shutoff_valve_2_condition, '')) <= 200),
  add constraint tr_gauge_serial_len check (char_length(test_gauge_serial) <= 100),
  add constraint tr_repairs_made_len check (char_length(coalesce(repairs_made, '')) <= 5000),
  add constraint tr_notes_len check (char_length(coalesce(notes, '')) <= 5000),
  add constraint tr_emailed_to_len check (char_length(coalesce(emailed_to, '')) <= 255);
