import { prisma } from "@/lib/prisma";
import { EscalatedCasesClient } from "./escalated-cases-client";

export const dynamic = "force-dynamic";

export default async function EscalatedCasesPage() {
  const cases = await prisma.escalatedCase.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl text-[#202124]">Escalated Cases</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Cases flagged for specialist attention. Review, add notes, and update
          status as cases are assessed.
        </p>
      </div>

      <EscalatedCasesClient
        cases={cases.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
