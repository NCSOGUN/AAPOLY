"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Specialty = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  _count: { facilities: number };
};

interface Props {
  specialties: Specialty[];
}

export function SpecialtiesClient({ specialties }: Props) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newForm, setNewForm] = useState({ name: "", code: "", description: "" });
  const [editForm, setEditForm] = useState({ name: "", code: "", description: "" });

  function startEdit(s: Specialty) {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      code: s.code ?? "",
      description: s.description ?? "",
    });
  }

  async function handleAdd() {
    if (!newForm.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to add specialty.");
        return;
      }
      setNewForm({ name: "", code: "", description: "" });
      setShowAddForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/specialties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to update specialty.");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete specialty "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/specialties/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to delete specialty.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <span className="text-sm text-[#5f6368]">
          {specialties.length} specialt{specialties.length === 1 ? "y" : "ies"}
        </span>
        <Button
          size="sm"
          onClick={() => setShowAddForm((v) => !v)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add specialty
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
          <h3 className="text-sm font-medium text-[#202124] mb-4">
            New Specialty
          </h3>
          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={newForm.name}
                onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="ENT"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={newForm.code}
                onChange={(e) => setNewForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="ENT-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={newForm.description}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Ear, Nose and Throat"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={loading}>
              {loading ? "Adding…" : "Add"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {specialties.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#5f6368]">No specialties defined yet.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Facilities
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#5f6368] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {specialties.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                {editingId === s.id ? (
                  <>
                    <td className="px-6 py-3">
                      <Input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, name: e.target.value }))
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Input
                        value={editForm.code}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, code: e.target.value }))
                        }
                        className="h-8"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Input
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        className="h-8"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-6 py-3 text-[#5f6368]">
                      {s._count.facilities}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleUpdate(s.id)}
                          disabled={loading}
                          className="rounded border border-green-200 bg-white p-1.5 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-3 font-medium text-[#202124]">
                      {s.name}
                    </td>
                    <td className="px-6 py-3 text-[#5f6368]">
                      {s.code ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-[#5f6368]">
                      {s.description ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-[#5f6368]">
                      {s._count.facilities}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          disabled={deletingId === s.id}
                          className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingId === s.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
