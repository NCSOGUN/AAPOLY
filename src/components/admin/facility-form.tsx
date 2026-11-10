"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Specialty = {
  id: string;
  name: string;
  code: string | null;
};

type FacilityData = {
  id?: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  website: string;
  accredited: boolean;
  accreditationDate: string;
  notes: string;
  specialtyIds: string[];
  services: string[];
};

interface Props {
  initialData?: Partial<FacilityData>;
  specialties: Specialty[];
  mode: "create" | "edit";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function FacilityForm({ initialData, specialties, mode }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<FacilityData>({
    name: initialData?.name ?? "",
    slug: initialData?.slug ?? "",
    address: initialData?.address ?? "",
    city: initialData?.city ?? "",
    state: initialData?.state ?? "Ogun",
    country: initialData?.country ?? "Nigeria",
    latitude: initialData?.latitude ?? "",
    longitude: initialData?.longitude ?? "",
    phone: initialData?.phone ?? "",
    email: initialData?.email ?? "",
    website: initialData?.website ?? "",
    accredited: initialData?.accredited ?? false,
    accreditationDate: initialData?.accreditationDate ?? "",
    notes: initialData?.notes ?? "",
    specialtyIds: initialData?.specialtyIds ?? [],
    services: initialData?.services ?? [],
  });

  const [servicesText, setServicesText] = useState(
    (initialData?.services ?? []).join("\n")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: mode === "create" ? slugify(value) : prev.slug,
    }));
  }

  function toggleSpecialty(id: string) {
    setForm((prev) => ({
      ...prev,
      specialtyIds: prev.specialtyIds.includes(id)
        ? prev.specialtyIds.filter((s) => s !== id)
        : [...prev.specialtyIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const services = servicesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = { ...form, services };

    try {
      const url =
        mode === "create"
          ? "/api/admin/facilities"
          : `/api/admin/facilities/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Something went wrong.");
        return;
      }

      router.push("/admin/facilities");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-5">Basic Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Facility Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Ogun ENT Specialist Hospital"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="ogun-ent-specialist-hospital"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+234 801 234 5678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="info@hospital.ng"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://hospital.ng"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-5">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="12 Hospital Road, Abeokuta"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City / LGA</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="Abeokuta"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={form.state}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
              placeholder="Ogun"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              placeholder="Nigeria"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="latitude">Latitude *</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
              placeholder="6.9123"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longitude">Longitude *</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
              placeholder="3.6481"
              required
            />
          </div>
        </div>
      </div>

      {/* Accreditation */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-5">Accreditation</h2>
        <div className="flex items-center gap-3 mb-4">
          <Checkbox
            id="accredited"
            checked={form.accredited}
            onCheckedChange={(checked) =>
              setForm((p) => ({ ...p, accredited: !!checked }))
            }
          />
          <Label htmlFor="accredited" className="cursor-pointer">
            This facility is accredited
          </Label>
        </div>
        {form.accredited && (
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="accreditationDate">Accreditation Date</Label>
            <Input
              id="accreditationDate"
              type="date"
              value={form.accreditationDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, accreditationDate: e.target.value }))
              }
            />
          </div>
        )}
      </div>

      {/* Specialties */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-5">Specialties</h2>
        {specialties.length === 0 ? (
          <p className="text-sm text-[#5f6368]">
            No specialties defined yet. Add some in the Specialties section.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {specialties.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <Checkbox
                  checked={form.specialtyIds.includes(s.id)}
                  onCheckedChange={() => toggleSpecialty(s.id)}
                />
                <span className="text-sm text-[#202124]">{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Services */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-2">Services</h2>
        <p className="text-sm text-[#5f6368] mb-4">
          One service per line (e.g. Audiometry, Nasal Endoscopy, CT Scan)
        </p>
        <Textarea
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          placeholder={"Audiometry\nNasal Endoscopy\nCT Scan\nTonsillectomy"}
          rows={6}
        />
      </div>

      {/* Notes */}
      <div className="rounded-md border border-gray-200 bg-white p-6">
        <h2 className="text-lg text-[#202124] mb-5">Notes</h2>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Any additional notes about this facility…"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving…"
            : mode === "create"
            ? "Create facility"
            : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
