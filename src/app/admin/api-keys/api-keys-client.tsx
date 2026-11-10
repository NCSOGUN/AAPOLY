"use client";

import { useState } from "react";
import {
  Plus, Copy, Check, Trash2, Eye, EyeOff,
  ShieldCheck, ShieldOff, Key
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  owner: string | null;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

interface Props {
  keys: ApiKey[];
}

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

export function ApiKeysClient({ keys: initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", owner: "" });
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Failed to create key.");
        return;
      }

      setNewKey(data.data.rawKey);
      setKeys((previous) => [
        {
          id: data.data.id,
          name: data.data.name,
          keyPrefix: data.data.keyPrefix,
          owner: data.data.owner,
          active: data.data.active,
          lastUsedAt: null,
          createdAt: data.data.createdAt,
        },
        ...previous,
      ]);
      setShowNewKey(true);
      setShowForm(false);
      setForm({ name: "", owner: "" });
    } catch {
      setError("Could not create an API key. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not update the API key.");
        return;
      }
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, active: !active } : k));
    } catch {
      setError("Could not update the API key. Check your connection and try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete key "${name}"? Any system using it will lose access immediately.`)) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        setError(data.message ?? "Could not delete the API key.");
        return;
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setError("Could not delete the API key. Check your connection and try again.");
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

      {/* ── New key reveal ── */}
      {newKey && (
        <div className="border border-green-200 bg-green-50">
          <div className="flex items-center justify-between border-b border-green-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-green-700" />
              <span className="text-sm font-medium text-green-800">Your new API key</span>
            </div>
            <button onClick={() => setNewKey(null)} className="text-xs text-green-700 hover:underline">Dismiss</button>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-green-700 mb-3">
              Copy this key now. For security, it will not be shown again.
            </p>
            <div className="flex items-center gap-2 bg-white border border-green-200 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-[#202124] break-all select-all">
                {showNewKey ? newKey : "•".repeat(newKey.length)}
              </code>
              <button
                onClick={() => setShowNewKey((v) => !v)}
                className="text-[#5f6368] hover:text-[#202124] flex-shrink-0"
              >
                {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <CopyButton text={newKey} />
            </div>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-base text-[#202124]">New API Key</h2>
          </div>
          <div className="p-6 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key name *</Label>
                <Input
                  id="key-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Patient PWA — Production"
                  autoFocus
                />
                <p className="text-xs text-[#5f6368]">Describe what system will use this key.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-owner">Owner / Team (optional)</Label>
                <Input
                  id="key-owner"
                  value={form.owner}
                  onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}
                  placeholder="e.g. Patient App Team"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={loading || !form.name.trim()}
                className="bg-[#1a73e8] px-4 py-2 text-sm text-white hover:bg-[#1557b0] transition-colors disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate key"}
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

      {/* ── Keys table ── */}
      <div className="border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <span className="text-sm text-[#5f6368]">
            {keys.length} key{keys.length !== 1 ? "s" : ""}
            {" · "}
            {keys.filter((k) => k.active).length} active
          </span>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-[#1a73e8] px-3 py-1.5 text-sm text-white hover:bg-[#1557b0] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New key
            </button>
          )}
        </div>

        {keys.length === 0 ? (
          <div className="py-16 text-center">
            <Key className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[#5f6368]">No API keys yet.</p>
            <p className="text-xs text-[#5f6368] mt-1">Create one to allow external systems to call the API.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Key prefix</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden md:table-cell">Owner</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden lg:table-cell">Last used</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-[#5f6368] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[#202124]">{k.name}</td>
                  <td className="px-5 py-3">
                    <code className="text-xs font-mono text-[#5f6368] bg-gray-100 px-1.5 py-0.5">
                      {k.keyPrefix}…
                    </code>
                  </td>
                  <td className="px-5 py-3 text-[#5f6368] text-xs hidden md:table-cell">
                    {k.owner ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[#5f6368] text-xs hidden lg:table-cell">
                    {timeAgo(k.lastUsedAt)}
                  </td>
                  <td className="px-5 py-3 text-[#5f6368] text-xs hidden lg:table-cell">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {k.active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 border border-green-200 bg-green-50 px-2 py-0.5">
                        <ShieldCheck className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 border border-gray-200 bg-gray-100 px-2 py-0.5">
                        <ShieldOff className="h-3 w-3" /> Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(k.id, k.active)}
                        disabled={togglingId === k.id}
                        className="border border-gray-200 bg-white px-2.5 py-1 text-xs text-[#5f6368] hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {togglingId === k.id ? "…" : k.active ? "Revoke" : "Re-enable"}
                      </button>
                      <button
                        onClick={() => handleDelete(k.id, k.name)}
                        disabled={deletingId === k.id}
                        className="border border-gray-200 bg-white px-2.5 py-1 text-xs text-[#5f6368] hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Usage guide ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">How to use a key</h2>
        </div>
        <div className="p-6 space-y-3 text-sm text-[#5f6368]">
          <p>Include the key in every API request using the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5">X-API-Key</code> header:</p>
          <pre className="bg-gray-50 border border-gray-200 px-4 py-3 text-xs font-mono text-[#202124] overflow-x-auto">{`POST /api/v1/nearby
Content-Type: application/json
X-API-Key: ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

{ "latitude": 6.9123, "longitude": 3.6481, "radiusKm": 40 }`}</pre>
          <p className="text-xs">Store the key in your app&apos;s environment variables — never in client-side code or version control.</p>
        </div>
      </div>

    </div>
  );
}
