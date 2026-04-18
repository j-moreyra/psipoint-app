import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, getCustomer } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import {
  hazardTypes,
  locationTypes,
  type HazardType,
  type LocationType,
  type ServiceLocationInput,
} from "@/lib/validation/service-locations";
import { ServiceLocationForm } from "../../service-location-form";

export const metadata: Metadata = { title: "Edit service location" };

// Coerce a nullable DB enum column back into the form's "" | enum shape.
function toEnumField<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | "" {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return "";
}

export default async function EditServiceLocationPage({
  params,
}: {
  params: Promise<{ id: string; locId: string }>;
}) {
  const { id, locId } = await params;
  const supabase = await createClient();

  const [customer, location] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
  ]);

  if (!customer || !location || location.customer_id !== customer.id) {
    notFound();
  }

  const defaults: ServiceLocationInput = {
    nickname: location.nickname ?? "",
    address_line_1: location.address_line_1,
    address_line_2: location.address_line_2 ?? "",
    city: location.city,
    state: location.state,
    zip: location.zip,
    location_type: toEnumField<LocationType>(
      location.location_type,
      locationTypes,
    ),
    on_site_contact_first_name: location.on_site_contact_first_name ?? "",
    on_site_contact_last_name: location.on_site_contact_last_name ?? "",
    on_site_contact_phone: location.on_site_contact_phone ?? "",
    on_site_contact_email: location.on_site_contact_email ?? "",
    water_district: location.water_district ?? "",
    access_notes: location.access_notes ?? "",
    hazard_type: toEnumField<HazardType>(location.hazard_type, hazardTypes),
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink
          href={`/customers/${customer.id}`}
          label={customerDisplayName(customer)}
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          {serviceLocationDisplayName(location)}
        </h1>
      </div>
      <ServiceLocationForm
        mode="edit"
        customerId={customer.id}
        locationId={location.id}
        defaults={defaults}
      />
    </div>
  );
}
