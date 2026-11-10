"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Search, CheckCircle2, Circle } from "lucide-react";
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
  initialFilter: string;
}

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Accredited", value: "accredited" },
  { label: "Not accredited", value: "unaccredited" },
];

export function FacilitiesClient({ facilities, initialSearch, initialFilter }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState(initialFilter || "all");
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // optimistic accreditation state
  const [localAccredited, setLocalAccredited] = useState<Record<string, boolean>>({});

  function pushParams(newSearch: string, newFilter: string) {
    const params = new URLSearchParams();
    if (newSearch) params.set("search", newSearch);
    if (newFilter && newFilter !== "all") params.set("filter", newFilter);
    router.push(`/admin/facilities?${params.toString()}`);
  }

  function handleSearch(value: string) {
    setSearch(value);
    startTransition(() => pushParams(value, filter));
  }

  function handleFilter(value: string) {
    setFilter(value);
    startTransition(() => pushParams(search, value));
  }

  async function handleAccreditationToggle(facility: Facility) {
    const currentState = localAccredited[facility.id] ?? facility.accredited;
    const newState = !currentState;

    // Optimistic update
    setLocalAccredited((prev) => ({ ...prev, [facility.id]: newState }));
    setTogglingId(facility.id);

    try {
      const res = await fetch(`/api/admin/facilities/${facility.id}/accreditation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accredited: newState }),
      });

      if (!res.ok) {
        // Revert on failure
        setLocalAccredited((prev) => ({ ...prev, [facility.id]: currentState }));
        alert("Failed to update accreditation status.");
      } else {
        router.refresh();
      }
    } catch {
      setLocalAccredited((prev) => ({ ...prev, [facility.id]: currentState }));
    } finally {
      setTogglingId(null);
    }
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
    <div className="border border-gray-200 bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#5f6368]" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, city, state…"
            className="pl-9 text-sm"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex border border-gray-200 divide-x divide-gray-200">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilter(opt.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                filter === opt.value
                  ? "bg-blue-50 text-[#1a73e8]"
                  : "bg-white text-[#5f6368] hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden md:table-cell">
                Specialties
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden lg:table-cell">
                Services
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Accreditation
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {facilities.map((f) => {
              const isAccredited = localAccredited[f.id] ?? f.accredited;
              return (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-[#202124]">
                    {f.name}
                  </td>
                  <td className="px-4 py-3 text-[#5f6368] text-xs">
                    {[f.city, f.state].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-[#5f6368] text-xs hidden md:table-cell max-w-[200px] truncate">
                    {f.specialties.length > 0
                      ? f.specialties.map((s) => s.specialty.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#5f6368] text-xs hidden lg:table-cell">
                    {f._count.services > 0 ? `${f._count.services} service${f._count.services !== 1 ? "s" : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleAccreditationToggle(f)}
                      disabled={togglingId === f.id}
                      title={isAccredited ? "Click to remove accreditation" : "Click to accredit"}
                      className="flex items-center gap-1.5 transition-opacity disabled:opacity-50 group"
                    >
                      {isAccredited ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-700 group-hover:text-green-900">Accredited</span>
                        </>
                      ) : (
                        <>
                          <Circle className="h-4 w-4 text-gray-300" />
                          <span className="text-xs text-[#5f6368] group-hover:text-[#202124]">Not accredited</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/facilities/${f.id}/edit`}
                        className="inline-flex items-center gap-1 border border-gray-200 bg-white px-2.5 py-1 text-xs text-[#5f6368] hover:bg-gray-50 hover:text-[#202124] transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(f.id, f.name)}
                        disabled={deletingId === f.id}
                        className="inline-flex items-center gap-1 border border-gray-200 bg-white px-2.5 py-1 text-xs text-[#5f6368] hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingId === f.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Footer count */}
      <div className="border-t border-gray-200 px-4 py-2.5">
        <p className="text-xs text-[#5f6368]">
          {facilities.length} facilit{facilities.length === 1 ? "y" : "ies"}
        </p>
      </div>
    </div>
  );
}
