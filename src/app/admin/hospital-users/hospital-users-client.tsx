"use client";

import { useState, Fragment } from "react";
import {
  Plus, Copy, Check, Trash2, Eye, EyeOff,
  ShieldCheck, ShieldOff, Key, RotateCcw, Pencil, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type HospitalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
  phone: string | null;
  licenseNumber: string | null;
  facilityId: string | null;
  facility: { id: string; name: string } | null;
  tokenPrefix: string;
  tokenIssuedAt: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type FacilityOption = { id: string; name: string };

interface Props {
  users: HospitalUser[];
  facilities: FacilityOption[];
}

const ROLES = ["doctor", "specialist", "nurse", "admin"];

// Matches the api-keys input styling, minus the shadow (flat Google aesthetic).
const selectClass =
  "flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#202124] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-[#5f6368] hover:text-[#202124] border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      {copied ? <><Check className="h-3 w-3 text-green-600" /><span className="text-green-600">Copied</span></> : <><Copy className="h-3 w-3" /><span>Copy</span></>}
    </button>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "doctor",
  specialization: "",
  phone: "",
  licenseNumber: "",
  facilityId: "",
};

export function HospitalUsersClient({ users: initialUsers, facilities }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showNewToken, setShowNewToken] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "doctor",
    specialization: "",
    phone: "",
    licenseNumber: "",
    facilityId: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/hospital-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          specialization: form.specialization || undefined,
          phone: form.phone || undefined,
          licenseNumber: form.licenseNumber || undefined,
          facilityId: form.facilityId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Failed to create user.");
        return;
      }

      setNewToken(data.data.token);
      setUsers((prev) => [
        {
          id: data.data.id,
          name: data.data.name,
          email: data.data.email,
          role: data.data.role,
          specialization: data.data.specialization,
          phone: data.data.phone,
          licenseNumber: data.data.licenseNumber,
          facilityId: data.data.facilityId,
          facility: facilities.find((f) => f.id === data.data.facilityId) ?? null,
          tokenPrefix: data.data.tokenPrefix,
          tokenIssuedAt: new Date(data.data.tokenIssuedAt).toISOString(),
          active: data.data.active,
          lastLoginAt: null,
          createdAt: new Date(data.data.createdAt).toISOString(),
        },
        ...prev,
      ]);
      setShowNewToken(true);
      setShowForm(false);
      setForm(emptyForm);
    } catch {
      setError("Could not create the user. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(u: HospitalUser) {
    setEditingId(u.id);
    setEditForm({
      name: u.name,
      role: u.role,
      specialization: u.specialization ?? "",
      phone: u.phone ?? "",
      licenseNumber: u.licenseNumber ?? "",
      facilityId: u.facilityId ?? "",
    });
    setError("");
  }

  async function handleSaveEdit(id: string) {
    setEditLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/hospital-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role,
          specialization: editForm.specialization || null,
          phone: editForm.phone || null,
          licenseNumber: editForm.licenseNumber || null,
          facilityId: editForm.facilityId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not update the user.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                name: data.data.name,
                role: data.data.role,
                specialization: data.data.specialization,
                phone: data.data.phone,
                licenseNumber: data.data.licenseNumber,
                facilityId: data.data.facilityId,
                facility: data.data.facility,
              }
            : u
        )
      );
      setEditingId(null);
    } catch {
      setError("Could not update the user. Check your connection and try again.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/hospital-users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not update the user.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !active } : u)));
    } catch {
      setError("Could not update the user. Check your connection and try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleResetToken(id: string, name: string) {
    if (!confirm(`Reset the access token for ${name}? The old token will stop working immediately.`)) return;
    setResettingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/hospital-users/${id}/reset-token`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not reset the token.");
        return;
      }
      setNewToken(data.data.token);
      setShowNewToken(true);
    } catch {
      setError("Could not reset the token. Check your connection and try again.");
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/hospital-users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not delete the user.");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError("Could not delete the user. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && !showForm && (
        <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── New token reveal ── */}
      {newToken && (
        <div className="border border-green-200 bg-green-50">
          <div className="flex items-center justify-between border-b border-green-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-green-700" />
              <span className="text-sm font-medium text-green-800">Your new hospital user token</span>
            </div>
            <button onClick={() => setNewToken(null)} className="text-xs text-green-700 hover:underline">Dismiss</button>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-green-700 mb-3">
              Copy this token now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-white border border-green-200 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-[#202124] break-all select-all">
                {showNewToken ? newToken : "•".repeat(newToken.length)}
              </code>
              <button
                onClick={() => setShowNewToken((v) => !v)}
                className="text-[#5f6368] hover:text-[#202124] flex-shrink-0"
              >
                {showNewToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <CopyButton text={newToken} />
            </div>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base text-[#202124]">New hospital user</h2>
          </div>
          <div className="p-6 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hu-name">Full name *</Label>
                <Input
                  id="hu-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Dr. Jane Doe"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-email">Email *</Label>
                <Input
                  id="hu-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane.doe@hospital.ng"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-password">Temporary password *</Label>
                <Input
                  id="hu-password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="At least 6 characters"
                />
                <p className="text-xs text-[#5f6368]">Give this to the user for first login. They can change it later.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-role">Role</Label>
                <select
                  id="hu-role"
                  className={selectClass}
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize">{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-spec">Specialization (optional)</Label>
                <Input
                  id="hu-spec"
                  value={form.specialization}
                  onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                  placeholder="e.g. Otologist"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-phone">Phone (optional)</Label>
                <Input
                  id="hu-phone"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. +234 801 234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-license">License number (optional)</Label>
                <Input
                  id="hu-license"
                  value={form.licenseNumber}
                  onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                  placeholder="Professional registration number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hu-facility">Facility (optional)</Label>
                <select
                  id="hu-facility"
                  className={selectClass}
                  value={form.facilityId}
                  onChange={(e) => setForm((p) => ({ ...p, facilityId: e.target.value }))}
                >
                  <option value="">No facility</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={loading || !form.name.trim() || !form.email.trim() || !form.password}
                className="bg-[#1a73e8] px-4 py-2 text-sm text-white hover:bg-[#1557b0] transition-colors disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create user"}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users table ── */}
      <div className="border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <span className="text-sm text-[#5f6368]">
            {users.length} user{users.length !== 1 ? "s" : ""}
            {" · "}
            {users.filter((u) => u.active).length} active
          </span>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-[#1a73e8] px-3 py-1.5 text-sm text-white hover:bg-[#1557b0] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New user
            </button>
          )}
        </div>

        {users.length === 0 ? (
          <div className="py-16 text-center">
            <Key className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[#5f6368]">No hospital users yet.</p>
            <p className="text-xs text-[#5f6368] mt-1">Create one to give a hospital or doctor access to the desktop app.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden md:table-cell">Facility</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden lg:table-cell">Last login</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#5f6368] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#202124] text-sm">{u.name}</div>
                        {u.specialization && (
                          <div className="text-xs text-[#5f6368]">{u.specialization}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#5f6368] text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-[#5f6368] text-xs capitalize">{u.role}</td>
                      <td className="px-4 py-3 text-[#5f6368] text-xs hidden md:table-cell">
                        <span className="line-clamp-2">{u.facility?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-[#5f6368] text-xs hidden lg:table-cell">{timeAgo(u.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 border border-green-200 bg-green-50 px-2 py-0.5 whitespace-nowrap">
                            <ShieldCheck className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 border border-gray-200 bg-gray-100 px-2 py-0.5 whitespace-nowrap">
                            <ShieldOff className="h-3 w-3" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => (editingId === u.id ? setEditingId(null) : startEdit(u))}
                            className="inline-flex items-center gap-1 border border-gray-200 bg-white px-2 py-1 text-xs text-[#5f6368] hover:bg-gray-50 transition-colors whitespace-nowrap"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(u.id, u.active)}
                            disabled={togglingId === u.id}
                            className="border border-gray-200 bg-white px-2 py-1 text-xs text-[#5f6368] hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {togglingId === u.id ? "…" : u.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => handleResetToken(u.id, u.name)}
                            disabled={resettingId === u.id}
                            className="inline-flex items-center gap-1 border border-gray-200 bg-white px-2 py-1 text-xs text-[#5f6368] hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="Reset access token"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {resettingId === u.id ? "…" : "Token"}
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            disabled={deletingId === u.id}
                            className="border border-gray-200 bg-white px-2 py-1 text-xs text-[#5f6368] hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            {deletingId === u.id ? "…" : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === u.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50">
                          <div className="border border-gray-200 bg-white p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-[#202124]">Edit {u.name}</span>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-[#5f6368] hover:text-[#202124]"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-name-${u.id}`}>Full name</Label>
                                <Input
                                  id={`edit-name-${u.id}`}
                                  value={editForm.name}
                                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-role-${u.id}`}>Role</Label>
                                <select
                                  id={`edit-role-${u.id}`}
                                  className={selectClass}
                                  value={editForm.role}
                                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                                >
                                  {ROLES.map((r) => (
                                    <option key={r} value={r} className="capitalize">{r}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-spec-${u.id}`}>Specialization</Label>
                                <Input
                                  id={`edit-spec-${u.id}`}
                                  value={editForm.specialization}
                                  onChange={(e) => setEditForm((p) => ({ ...p, specialization: e.target.value }))}
                                  placeholder="e.g. Otologist"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-phone-${u.id}`}>Phone</Label>
                                <Input
                                  id={`edit-phone-${u.id}`}
                                  value={editForm.phone}
                                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                                  placeholder="+234 801 234 5678"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-license-${u.id}`}>License number</Label>
                                <Input
                                  id={`edit-license-${u.id}`}
                                  value={editForm.licenseNumber}
                                  onChange={(e) => setEditForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`edit-facility-${u.id}`}>Facility</Label>
                                <select
                                  id={`edit-facility-${u.id}`}
                                  className={selectClass}
                                  value={editForm.facilityId}
                                  onChange={(e) => setEditForm((p) => ({ ...p, facilityId: e.target.value }))}
                                >
                                  <option value="">No facility</option>
                                  {facilities.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleSaveEdit(u.id)}
                                disabled={editLoading || !editForm.name.trim()}
                                className="bg-[#1a73e8] px-4 py-2 text-sm text-white hover:bg-[#1557b0] transition-colors disabled:opacity-50"
                              >
                                {editLoading ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Usage guide ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">How the desktop app uses the token</h2>
        </div>
        <div className="p-6 space-y-3 text-sm text-[#5f6368]">
          <p>The desktop app logs in once with the email + password at <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5">POST /api/v1/hospital-auth</code> and receives the long-lived token. It then sends the token on every API call:</p>
          <pre className="bg-gray-50 border border-gray-200 px-4 py-3 text-xs font-mono text-[#202124] overflow-x-auto">{`POST /api/v1/nearby
Content-Type: application/json
X-API-Key: hu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

{ "latitude": 6.9123, "longitude": 3.6481, "radiusKm": 40 }`}</pre>
          <p className="text-xs">After first login the token is stored locally. To re-verify after the app wakes from offline, call <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5">GET /api/v1/hospital-auth/verify</code> with the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5">X-Hospital-Token</code> header.</p>
        </div>
      </div>

    </div>
  );
}
