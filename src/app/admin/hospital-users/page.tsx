import { prisma } from "@/lib/prisma";
import { HospitalUsersClient } from "./hospital-users-client";

export const dynamic = "force-dynamic";

export default async function HospitalUsersPage() {
  const [users, facilities] = await Promise.all([
    prisma.hospitalUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        specialization: true,
        phone: true,
        licenseNumber: true,
        facilityId: true,
        accessToken: true,
        tokenIssuedAt: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        facility: { select: { id: true, name: true } },
      },
    }),
    prisma.facility.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Omit the raw accessToken; surface only a non-secret prefix for display.
  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    specialization: u.specialization,
    phone: u.phone,
    licenseNumber: u.licenseNumber,
    facilityId: u.facilityId,
    facility: u.facility,
    tokenPrefix: u.accessToken.slice(0, 8) + "…",
    tokenIssuedAt: u.tokenIssuedAt.toISOString(),
    active: u.active,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl text-[#202124]">Hospital Users</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Create accounts for hospitals, doctors and specialists. Each user gets a
          long-lived token for the desktop app, shown only once at creation.
        </p>
      </div>

      <HospitalUsersClient users={serializedUsers} facilities={facilities} />
    </div>
  );
}
