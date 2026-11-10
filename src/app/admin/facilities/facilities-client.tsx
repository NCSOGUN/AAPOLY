"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Facility = {
  id: string;
  name: string;
  city: string | null;
  state: string;
  accredited: boolean;
  specialties: { specialty: { name: string } }[];
  _count: { services: number };
};

interface Props {
  facilities: Facility[];
  initialSearch: string;
}

export function FacilitiesClient({ facilities, initialSearch }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      router.push(`/admin/facilities?${params.toString()}`);
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/facilities/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete facility.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      {/* Search bar */}
      <div className="border-b border-gray-200 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5f6368]" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search facilities…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {facilities.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#5f6368]">No facilities found.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Specialties
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Services
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {facilities.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#202124]">
                  {f.name}
                </td>
                <td className="px-4 py-3 text-[#5f6368]">
                  {[f.city, f.state].filter(Boolean).join(", ")}
                </td>
                <td className="px-4 py-3 text-[#5f6368]">
                  {f.specialties.length > 0
                    ? f.specialties.map((s) => s.specialty.name).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-[#5f6368]">
                  {f._count.services}
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/facilities/${f.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
                      disabled={deletingId === f.id}
                      className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      {deletingId === f.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
