import { prisma } from "@/lib/prisma";
import { ApiKeysClient } from "./api-keys-client";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      owner: true,
      active: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl text-[#202124]">API Keys</h1>
        <p className="mt-1 text-sm text-[#5f6368]">
          Issue keys for external systems that call the Location Intelligence API.
          Each key is shown only once at creation.
        </p>
      </div>

      <ApiKeysClient
        keys={keys.map((key) => ({
          ...key,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          createdAt: key.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
