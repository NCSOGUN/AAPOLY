"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

type EscalatedCase = {
  id: string;
  symptoms: string;
  affectedArea: string | null;
  duration: string | null;
  age: number | null;
  additionalContext: string | null;
  analysisResult: unknown;
  imageUrls: string[];
  status: string;
  consentGiven: boolean;
  patientEmail: string | null;
  specialistNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type FilterValue = "all" | "pending" | "under_review" | "responded" | "closed";

interface Props {
  cases: EscalatedCase[];
}

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Under Review", value: "under_review" },
  { label: "Responded", value: "responded" },
  { label: "Closed", value: "closed" },
];

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs border border-yellow-200 bg-yellow-50 text-yellow-700">
          Pending
        </span>
      );
    case "under_review":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs border border-blue-200 bg-blue-50 text-[#1a73e8]">
          Under Review
        </span>
      );
    case "responded":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs border border-green-200 bg-green-50 text-green-700">
          Responded
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs border border-gray-200 bg-gray-100 text-gray-500">
          Closed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs border border-gray-200 bg-gray-100 text-gray-500">
          {status}
        </span>
      );
  }
}

type EditState = {
  specialistNotes: string;
  status: string;
};

export function EscalatedCasesClient({ cases: initialCases }: Props) {
  const [cases, setCases] = useState(initialCases);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(
      initialCases.map((c) => [
        c.id,
        { specialistNotes: c.specialistNotes ?? "", status: c.status },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  const filtered =
    activeFilter === "all"
      ? cases
      : cases.filter((c) => c.status === activeFilter);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function updateEdit(id: string, patch: Partial<EditState>) {
    setEditStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(id: string) {
    setSavingId(id);
    setSaveError((prev) => ({ ...prev, [id]: "" }));
    const edit = editStates[id];
    try {
      const res = await fetch(`/api/admin/escalated-cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistNotes: edit.specialistNotes,
          status: edit.status,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setSaveError((prev) => ({
          ...prev,
          [id]: data.message ?? "Failed to save.",
        }));
        return;
      }
      setCases((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                specialistNotes: edit.specialistNotes || null,
                status: edit.status,
                updatedAt: data.data.updatedAt ?? c.updatedAt,
              }
            : c
        )
      );
    } catch {
      setSaveError((prev) => ({
        ...prev,
        [id]: "Could not save. Check your connection and try again.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={
              activeFilter === f.value
                ? "px-3 py-1.5 text-sm border border-[#1a73e8] bg-blue-50 text-[#1a73e8] transition-colors"
                : "px-3 py-1.5 text-sm border border-gray-200 bg-white text-[#5f6368] hover:bg-gray-50 hover:text-[#202124] transition-colors"
            }
          >
            {f.label}
            {f.value === "all"
              ? ` (${cases.length})`
              : ` (${cases.filter((c) => c.status === f.value).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[#5f6368]">No cases found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  Symptoms
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden md:table-cell">
                  Consent
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden lg:table-cell">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const isExpanded = expandedId === c.id;
                const edit = editStates[c.id] ?? {
                  specialistNotes: c.specialistNotes ?? "",
                  status: c.status,
                };

                return (
                  <>
                    {/* Main row */}
                    <tr
                      key={c.id}
                      onClick={() => toggleExpand(c.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-5 py-3 text-[#202124]">
                        {c.symptoms.length > 80
                          ? c.symptoms.slice(0, 80) + "…"
                          : c.symptoms}
                      </td>
                      <td className="px-5 py-3">{statusBadge(c.status)}</td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {c.consentGiven ? (
                          <span className="text-xs text-green-700 border border-green-200 bg-green-50 px-2 py-0.5">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 border border-gray-200 bg-gray-100 px-2 py-0.5">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#5f6368] hidden lg:table-cell">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${c.id}-expanded`}>
                        <td
                          colSpan={4}
                          className="px-5 py-5 bg-gray-50 border-t border-gray-200"
                        >
                          <div className="space-y-4">
                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-4 text-xs text-[#5f6368] sm:grid-cols-4">
                              {c.affectedArea && (
                                <div>
                                  <span className="font-medium text-[#202124]">
                                    Area
                                  </span>
                                  <p>{c.affectedArea}</p>
                                </div>
                              )}
                              {c.duration && (
                                <div>
                                  <span className="font-medium text-[#202124]">
                                    Duration
                                  </span>
                                  <p>{c.duration}</p>
                                </div>
                              )}
                              {c.age !== null && (
                                <div>
                                  <span className="font-medium text-[#202124]">
                                    Age
                                  </span>
                                  <p>{c.age}</p>
                                </div>
                              )}
                              {c.patientEmail && (
                                <div>
                                  <span className="font-medium text-[#202124]">
                                    Email
                                  </span>
                                  <p>{c.patientEmail}</p>
                                </div>
                              )}
                            </div>

                            {/* Analysis result */}
                            <div>
                              <p className="text-xs font-medium text-[#202124] mb-1">
                                Analysis Result
                              </p>
                              <pre className="bg-white border border-gray-200 px-4 py-3 text-xs font-mono text-[#202124] overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(c.analysisResult, null, 2)}
                              </pre>
                            </div>

                            {/* Specialist notes */}
                            <div>
                              <label
                                htmlFor={`notes-${c.id}`}
                                className="text-xs font-medium text-[#202124] mb-1 block"
                              >
                                Specialist Notes
                              </label>
                              <textarea
                                id={`notes-${c.id}`}
                                rows={4}
                                value={edit.specialistNotes}
                                onChange={(e) =>
                                  updateEdit(c.id, {
                                    specialistNotes: e.target.value,
                                  })
                                }
                                className="w-full border border-gray-200 px-3 py-2 text-sm text-[#202124] bg-white focus:outline-none focus:border-[#1a73e8] resize-none"
                                placeholder="Add specialist observations and recommendations…"
                              />
                            </div>

                            {/* Status select + save */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div>
                                <label
                                  htmlFor={`status-${c.id}`}
                                  className="text-xs font-medium text-[#202124] mr-2"
                                >
                                  Status
                                </label>
                                <select
                                  id={`status-${c.id}`}
                                  value={edit.status}
                                  onChange={(e) =>
                                    updateEdit(c.id, { status: e.target.value })
                                  }
                                  className="border border-gray-200 px-2 py-1.5 text-sm text-[#202124] bg-white focus:outline-none focus:border-[#1a73e8]"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="under_review">
                                    Under Review
                                  </option>
                                  <option value="responded">Responded</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSave(c.id);
                                }}
                                disabled={savingId === c.id}
                                className="bg-[#1a73e8] px-4 py-1.5 text-sm text-white hover:bg-[#1557b0] transition-colors disabled:opacity-50"
                              >
                                {savingId === c.id ? "Saving…" : "Save"}
                              </button>

                              {saveError[c.id] && (
                                <p className="text-xs text-red-600">
                                  {saveError[c.id]}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
