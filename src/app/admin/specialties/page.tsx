import { prisma } from "@/lib/prisma";
import { SpecialtiesClient } from "./specialties-client";

export const dynamic = "force-dynamic";

async function getSpecialties() {
  try {
    return await prisma.specialty.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { facilities: true } } },
    });
  } catch {
    return [];
  }
}

export default async function SpecialtiesPage() {
  const specialties = await getSpecialties();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl text-[#202124]">Specialties</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Manage medical specialties available in the system
        </p>
      </div>

      <SpecialtiesClient specialties={specialties} />
    </div>
  );
}
