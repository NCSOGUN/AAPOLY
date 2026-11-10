"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const MapPicker = dynamic(
  () => import("./map-picker").then((module) => module.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-gray-100 text-sm text-[#5f6368]">
        Loading map…
      </div>
    ),
  }
);

type Specialty = {
  id: string;
  name: string;
  code: string | null;
};

type ServiceEntry = {
  id?: string;        // existing service id (edit mode)
  name: string;
  available: boolean;
};

export type OperatingHours = {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
};

const DEFAULT_HOURS: OperatingHours = {
  monday: "8:00 AM – 5:00 PM",
  tuesday: "8:00 AM – 5:00 PM",
  wednesday: "8:00 AM – 5:00 PM",
  thursday: "8:00 AM – 5:00 PM",
  friday: "8:00 AM – 5:00 PM",
  saturday: "Closed",
  sunday: "Closed",
};

const DAYS: (keyof OperatingHours)[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

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
  operatingHours: OperatingHours | null;
  notes: string;
  specialtyIds: string[];
  services: ServiceEntry[];
};

interface Props {
  initialData?: Partial<Omit<FacilityData, "services"> & { services: ServiceEntry[] }>;
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

function parseCoordinate(value: string, min: number, max: number): number | null {
  if (!value.trim()) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
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
    operatingHours: (initialData?.operatingHours as OperatingHours | null) ?? null,
    notes: initialData?.notes ?? "",
    specialtyIds: initialData?.specialtyIds ?? [],
    services: initialData?.services ?? [],
  });

  const [newServiceName, setNewServiceName] = useState("");
  const [showHours, setShowHours] = useState(!!initialData?.operatingHours);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapQuery, setMapQuery] = useState("");
  const [locationLookupLoading, setLocationLookupLoading] = useState(false);
  const [locationLookupError, setLocationLookupError] = useState("");
  const [locationFeedback, setLocationFeedback] = useState("");
  const locationLookupId = useRef(0);

  const selectedLatitude = parseCoordinate(form.latitude, -90, 90);
  const selectedLongitude = parseCoordinate(form.longitude, -180, 180);
  const hasMapPin = selectedLatitude !== null && selectedLongitude !== null;
  const mapLatitude = selectedLatitude ?? 6.9123;
  const mapLongitude = selectedLongitude ?? 3.6481;

  async function selectMapLocation(latitude: number, longitude: number) {
    const lookupId = ++locationLookupId.current;
    setLocationLookupLoading(true);
    setLocationLookupError("");
    setLocationFeedback("");
    setForm((prev) => ({
      ...prev,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));

    try {
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });
      const response = await fetch(`/api/admin/location?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "Could not resolve this map location.");
      }
      if (lookupId !== locationLookupId.current) return;

      const { address } = result.data;
      const streetAddress = [
        address.houseNumber,
        address.road,
        address.neighbourhood,
      ]
        .filter(Boolean)
        .join(", ");

      setForm((prev) => ({
        ...prev,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        address: streetAddress || result.data.displayName,
        city: address.town || address.lga || prev.city,
        state: address.state || prev.state,
        country: address.country || prev.country,
      }));
      setLocationFeedback("Map point selected and address details filled in.");
    } catch (lookupError) {
      if (lookupId === locationLookupId.current) {
        setLocationLookupError(
          lookupError instanceof Error
            ? lookupError.message
            : "Could not resolve this map location."
        );
      }
    } finally {
      if (lookupId === locationLookupId.current) {
        setLocationLookupLoading(false);
      }
    }
  }

  async function searchMapLocation() {
    const query = mapQuery.trim();
    if (!query) return;

    const lookupId = ++locationLookupId.current;
    setLocationLookupLoading(true);
    setLocationLookupError("");
    setLocationFeedback("");

    try {
      const response = await fetch(
        `/api/admin/location?q=${encodeURIComponent(query)}`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Could not find that place.");
      }
      if (lookupId !== locationLookupId.current) return;

      await selectMapLocation(result.data.lat, result.data.lng);
    } catch (lookupError) {
      if (lookupId === locationLookupId.current) {
        setLocationLookupError(
          lookupError instanceof Error
            ? lookupError.message
            : "Could not find that place."
        );
        setLocationLookupLoading(false);
      }
    }
  }

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

  function addService() {
    const name = newServiceName.trim();
    if (!name) return;
    if (form.services.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setForm((prev) => ({
      ...prev,
      services: [...prev.services, { name, available: true }],
    }));
    setNewServiceName("");
  }

  function removeService(index: number) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  }

  function toggleServiceAvailable(index: number) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s, i) =>
        i === index ? { ...s, available: !s.available } : s
      ),
    }));
  }

  function toggleHours(enabled: boolean) {
    setShowHours(enabled);
    setForm((prev) => ({
      ...prev,
      operatingHours: enabled ? DEFAULT_HOURS : null,
    }));
  }

  function updateHours(day: keyof OperatingHours, value: string) {
    setForm((prev) => ({
      ...prev,
      operatingHours: prev.operatingHours
        ? { ...prev.operatingHours, [day]: value }
        : { ...DEFAULT_HOURS, [day]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      ...form,
      latitude: form.latitude,
      longitude: form.longitude,
    };

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Basic Information ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Basic Information</h2>
        </div>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* ── Location ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Location</h2>
          <p className="text-xs text-[#5f6368] mt-0.5">
            Search for a place or click the map to pin the facility. Address
            details and coordinates will be filled in automatically.
          </p>
        </div>
        <div className="space-y-5 p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={mapQuery}
              onChange={(event) => setMapQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchMapLocation();
                }
              }}
              placeholder="Search a hospital, street, town, or area"
              aria-label="Search map location"
            />
            <Button
              type="button"
              onClick={() => void searchMapLocation()}
              disabled={locationLookupLoading || !mapQuery.trim()}
              className="shrink-0"
            >
              {locationLookupLoading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Find on map
            </Button>
          </div>

          <div className="relative h-[360px] overflow-hidden rounded-md border border-gray-200">
            <MapPicker
              latitude={mapLatitude}
              longitude={mapLongitude}
              hasPin={hasMapPin}
              onSelect={selectMapLocation}
            />
            {!hasMapPin && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded bg-white/95 px-3 py-1.5 text-xs text-[#5f6368] shadow">
                Click the map to place the facility pin
              </div>
            )}
          </div>

          <div aria-live="polite" className="min-h-5 text-sm">
            {locationLookupLoading && (
              <p className="flex items-center gap-2 text-[#5f6368]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Finding address details…
              </p>
            )}
            {!locationLookupLoading && locationFeedback && (
              <p className="flex items-center gap-2 text-green-700">
                <MapPin className="h-4 w-4" />
                {locationFeedback}
              </p>
            )}
            {locationLookupError && (
              <p className="text-red-600">{locationLookupError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="12 Hospital Road, Abeokuta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City / LGA</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) =>
                  setForm((p) => ({ ...p, city: e.target.value }))
                }
                placeholder="Abeokuta"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) =>
                  setForm((p) => ({ ...p, state: e.target.value }))
                }
                placeholder="Ogun"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) =>
                  setForm((p) => ({ ...p, country: e.target.value }))
                }
                placeholder="Nigeria"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude}
                onChange={(e) =>
                  setForm((p) => ({ ...p, latitude: e.target.value }))
                }
                onBlur={() => {
                  if (selectedLatitude !== null && selectedLongitude !== null) {
                    void selectMapLocation(selectedLatitude, selectedLongitude);
                  }
                }}
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
                min="-180"
                max="180"
                value={form.longitude}
                onChange={(e) =>
                  setForm((p) => ({ ...p, longitude: e.target.value }))
                }
                onBlur={() => {
                  if (selectedLatitude !== null && selectedLongitude !== null) {
                    void selectMapLocation(selectedLatitude, selectedLongitude);
                  }
                }}
                placeholder="3.6481"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Accreditation ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Accreditation</h2>
        </div>
        <div className="p-6">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <Checkbox
              id="accredited"
              checked={form.accredited}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, accredited: !!checked }))
              }
            />
            <span className="text-sm text-[#202124]">This facility is accredited</span>
          </label>
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
      </div>

      {/* ── Specialties ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Specialties</h2>
          <p className="text-xs text-[#5f6368] mt-0.5">
            Select all medical specialties this facility offers.
          </p>
        </div>
        <div className="p-6">
          {specialties.length === 0 ? (
            <p className="text-sm text-[#5f6368]">
              No specialties defined yet. Add some in the Specialties section.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 sm:grid-cols-3">
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
                  {s.code && (
                    <span className="text-xs text-[#5f6368]">({s.code})</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Services ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Services & Equipment</h2>
          <p className="text-xs text-[#5f6368] mt-0.5">
            Specific procedures, tests, or equipment available. Toggle to mark a service as temporarily unavailable.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* Add new service */}
          <div className="flex gap-2">
            <Input
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="e.g. Audiometry, Nasal Endoscopy, CT Scan"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addService();
                }
              }}
              className="flex-1"
            />
            <button
              type="button"
              onClick={addService}
              className="inline-flex items-center gap-1.5 border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Service list */}
          {form.services.length === 0 ? (
            <p className="text-sm text-[#5f6368]">No services added yet.</p>
          ) : (
            <div className="border border-gray-200 divide-y divide-gray-100">
              {form.services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50"
                >
                  <span className={`text-sm ${service.available ? "text-[#202124]" : "text-[#5f6368] line-through"}`}>
                    {service.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleServiceAvailable(index)}
                      className="flex items-center gap-1.5 text-xs text-[#5f6368] hover:text-[#202124] transition-colors"
                      title={service.available ? "Mark unavailable" : "Mark available"}
                    >
                      {service.available ? (
                        <><ToggleRight className="h-4 w-4 text-green-600" /><span className="text-green-700">Available</span></>
                      ) : (
                        <><ToggleLeft className="h-4 w-4 text-gray-400" /><span>Unavailable</span></>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      className="text-[#5f6368] hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Operating Hours ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base text-[#202124]">Operating Hours</h2>
              <p className="text-xs text-[#5f6368] mt-0.5">
                Optional. Set the facility's opening hours for each day.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={showHours}
                onCheckedChange={(c) => toggleHours(!!c)}
              />
              <span className="text-sm text-[#5f6368]">Set hours</span>
            </label>
          </div>
        </div>
        {showHours && form.operatingHours && (
          <div className="p-6">
            <div className="border border-gray-200 divide-y divide-gray-100">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4 px-4 py-2.5 bg-white">
                  <span className="w-28 text-sm text-[#5f6368] capitalize">{day}</span>
                  <Input
                    value={(form.operatingHours as OperatingHours)[day]}
                    onChange={(e) => updateHours(day, e.target.value)}
                    placeholder="e.g. 8:00 AM – 5:00 PM or Closed"
                    className="flex-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base text-[#202124]">Notes</h2>
        </div>
        <div className="p-6">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Any additional notes about this facility…"
            rows={3}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between py-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
