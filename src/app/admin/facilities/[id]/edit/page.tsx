import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FacilityForm } from "@/components/admin/facility-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

async function getFacility(id: string) {
  try {
    return await prisma.facility.findUnique({
      where: { id },
      include: {
        specialties: { include: { specialty: true } },
        services: true,
      },
    });
  } catch {
    return null;
  }
}

async function getSpecialties() {
  try {
    return await prisma.specialty.findMany({ orderBy: { name: "asc" } });
  } catch {
    return [];
  }
}

export default async function EditFacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [facility, specialties] = await Promise.all([
    getFacility(id),
    getSpecialties(),
  ]);

  if (!facility) notFound();

  const initialData = {
    id: facility.id,
    name: facility.name,
    slug: facility.slug,
    address: facility.address ?? "",
    city: facility.city ?? "",
    state: facility.state,
    country: facility.country,
    latitude: facility.latitude.toString(),
    longitude: facility.longitude.toString(),
    phone: facility.phone ?? "",
    email: facility.email ?? "",
    website: facility.website ?? "",
    accredited: facility.accredited,
    accreditationDate: facility.accreditationDate
      ? facility.accreditationDate.toISOString().split("T")[0]
      : "",
    notes: facility.notes ?? "",
    specialtyIds: facility.specialties.map((s) => s.specialtyId),
    services: facility.services.map((s) => s.name),
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/admin/facilities"
          className="inline-flex items-center gap-1 text-sm text-[#5f6368] hover:text-[#202124] mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to facilities
        </Link>
        <h1 className="text-2xl text-[#202124]">Edit Facility</h1>
        <p className="mt-1 text-sm text-[#5f6368]">{facility.name}</p>
      </div>

      <FacilityForm
        initialData={initialData}
        specialties={specialties}
        mode="edit"
      />
    </div>
  );
}
