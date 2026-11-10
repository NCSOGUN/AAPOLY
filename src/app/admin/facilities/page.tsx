import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FacilitiesClient } from "./facilities-client";

export const dynamic = "force-dynamic";

async function getFacilities(search: string, filter: string) {
  try {
    const accreditedFilter =
      filter === "accredited"
        ? { accredited: true }
        : filter === "unaccredited"
        ? { accredited: false }
        : {};

    const where = search
      ? {
          ...accreditedFilter,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
            { state: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : accreditedFilter;

    return await prisma.facility.findMany({
      where,
      orderBy: [{ accredited: "desc" }, { name: "asc" }],
      include: {
        specialties: { include: { specialty: true } },
        _count: { select: { services: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string }>;
}) {
  const { search = "", filter = "all" } = await searchParams;
  const facilities = await getFacilities(search, filter);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#202124]">Facilities</h1>
          <p className="mt-1 text-sm text-[#5f6368]">
            Manage the hospital and clinic registry
          </p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="inline-flex items-center gap-2 bg-[#1a73e8] px-4 py-2 text-sm text-white hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add facility
        </Link>
      </div>

      <FacilitiesClient
        facilities={facilities}
        initialSearch={search}
        initialFilter={filter}
      />
    </div>
  );
}
