import { prisma } from "@/lib/prisma";
import { FacilityForm } from "@/components/admin/facility-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

async function getSpecialties() {
  try {
    return await prisma.specialty.findMany({ orderBy: { name: "asc" } });
  } catch {
    return [];
  }
}

export default async function NewFacilityPage() {
  const specialties = await getSpecialties();

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
        <h1 className="text-2xl text-[#202124]">Add Facility</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Register a new ENT facility in the system
        </p>
      </div>

      <FacilityForm specialties={specialties} mode="create" />
    </div>
  );
}
