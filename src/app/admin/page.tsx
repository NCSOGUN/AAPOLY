import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { Building2, CheckCircle, Stethoscope, Activity } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const [totalFacilities, accreditedCount, totalSpecialties, totalServices] =
      await Promise.all([
        prisma.facility.count(),
        prisma.facility.count({ where: { accredited: true } }),
        prisma.specialty.count(),
        prisma.facilityService.count({ where: { available: true } }),
      ]);
    return { totalFacilities, accreditedCount, totalSpecialties, totalServices };
  } catch {
    return { totalFacilities: 0, accreditedCount: 0, totalSpecialties: 0, totalServices: 0 };
  }
}

async function getRecentFacilities() {
  try {
    return await prisma.facility.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { specialties: { include: { specialty: true } } },
    });
  } catch {
    return [];
  }
}

export default async function AdminDashboard() {
  const [stats, recentFacilities] = await Promise.all([
    getStats(),
    getRecentFacilities(),
  ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl text-[#202124]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Overview of the Location Intelligence Service
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Facilities"
          value={stats.totalFacilities}
          icon={Building2}
          description="All registered facilities"
        />
        <StatCard
          title="Accredited"
          value={stats.accreditedCount}
          icon={CheckCircle}
          description="Fully accredited facilities"
        />
        <StatCard
          title="Specialties"
          value={stats.totalSpecialties}
          icon={Stethoscope}
          description="Medical specialties defined"
        />
        <StatCard
          title="Active Services"
          value={stats.totalServices}
          icon={Activity}
          description="Available facility services"
        />
      </div>

      {/* Recent facilities */}
      <div className="rounded-md border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg text-[#202124]">Recent Facilities</h2>
          <Link
            href="/admin/facilities"
            className="text-sm text-[#1a73e8] hover:underline"
          >
            View all
          </Link>
        </div>

        {recentFacilities.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[#5f6368]">
              No facilities yet.{" "}
              <Link
                href="/admin/facilities/new"
                className="text-[#1a73e8] hover:underline"
              >
                Add one
              </Link>
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  Specialties
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentFacilities.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-[#202124]">
                    <Link
                      href={`/admin/facilities/${f.id}/edit`}
                      className="hover:text-[#1a73e8]"
                    >
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-[#5f6368]">
                    {f.city ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-[#5f6368]">
                    {f.specialties.map((s) => s.specialty.name).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-3">
                    {f.accredited ? (
                      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                        Accredited
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Not accredited
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
