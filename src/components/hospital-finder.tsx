"use client";

import { useState } from "react";
import {
  AlertCircle,
  MapPin,
  Navigation,
  Search,
} from "lucide-react";
import PatientPageHeader from "@/components/patient-page-header";
import { EntFacility, getFacilityList, isRecord } from "@/lib/ent-types";
import { getUserLocation } from "@/lib/geolocation";
import FacilityResults from "@/components/facility-results";

const specialties = [
  "ENT",
  "Otology",
  "Rhinology",
  "Laryngology",
  "Audiology",
  "Paediatric ENT",
] as const;

export default function HospitalFinder() {
  const [place, setPlace] = useState("");
  const [specialty, setSpecialty] = useState<string>("ENT");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [facilities, setFacilities] = useState<EntFacility[]>([]);
  const [selectedFacilityIndex, setSelectedFacilityIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const requestLocation = async () => {
    setError(null);
    setGettingLocation(true);
    try {
      const coordinates = await getUserLocation();
      setLatitude(coordinates.latitude);
      setLongitude(coordinates.longitude);
      setPlace("");
      setLocationLabel("Your current location");
    } catch (locationError) {
      setError(locationError instanceof Error
        ? locationError.message
        : "Your location could not be determined. Try again or enter a town or city.");
    } finally {
      setGettingLocation(false);
    }
  };

  const search = async () => {
    if ((latitude === null || longitude === null) && !place.trim()) {
      setError("Use your location or enter a town or city to search.");
      return;
    }

    setLoading(true);
    setError(null);
    setFacilities([]);
    setSelectedFacilityIndex(null);
    setSearched(false);
    try {
      const response = await fetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "nearby",
          ...(latitude !== null && longitude !== null
            ? { latitude, longitude }
            : { place: place.trim() }),
          specialty: specialty || undefined,
          radiusKm: 50,
          limit: 10,
          onlyAccredited: false,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!isRecord(data) || !response.ok || data.status !== "success") {
        throw new Error(
          isRecord(data) && typeof data.message === "string"
            ? data.message
            : "Nearby facilities could not be loaded.",
        );
      }
      setFacilities(getFacilityList(data));
      setSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Nearby facilities could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="assessment-page">
      <PatientPageHeader />
      <div className="assessment-shell">
        <div className="assessment-intro">
          <div className="assessment-intro-copy">
            <p className="assessment-eyebrow"><span className="eyebrow-rule" /> FIND CARE</p>
            <h1>Care options, closer to you.</h1>
            <p className="assessment-lede">
              Search the service&apos;s facility directory by location. You can use your current location or enter a town or city.
            </p>
          </div>
        </div>

        <section className="assessment-workspace report-lookup-workspace">
          <div className="assessment-form-panel">
            <div className="assessment-hospital-search hospital-finder-form">
              <span className="assessment-result-index">LOCATION SEARCH</span>
              <h3>Where should we look?</h3>
              <p>Your location is used to find nearby facilities and is not required.</p>

              <button
                type="button"
                className="assessment-back-button"
                onClick={() => void requestLocation()}
                disabled={gettingLocation}
              >
                <Navigation aria-hidden="true" size={16} />
                {gettingLocation ? "Getting your location…" : locationLabel || "Use my location"}
              </button>

              <label className="assessment-email-label" htmlFor="hospital-place">
                Or enter a town or city
              </label>
              <input
                id="hospital-place"
                type="text"
                className="assessment-text-input"
                value={place}
                onChange={(event) => {
                  setPlace(event.target.value);
                  setLatitude(null);
                  setLongitude(null);
                  setLocationLabel("");
                }}
                placeholder="For example, Sagamu, Ogun State"
                autoComplete="address-level2"
              />

              <label className="assessment-email-label" htmlFor="hospital-specialty">
                Specialty (optional)
              </label>
              <select
                id="hospital-specialty"
                className="assessment-text-input"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
              >
                {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
                <option value="">All available facilities</option>
              </select>

              <button
                type="button"
                className="assessment-continue-button"
                disabled={loading}
                onClick={() => void search()}
              >
                <Search aria-hidden="true" size={16} />
                {loading ? "Searching…" : "Find nearby care"}
              </button>
            </div>

            {error && (
              <div className="assessment-error" role="alert">
                <AlertCircle aria-hidden="true" size={18} />
                <span>{error}</span>
              </div>
            )}

            {searched && facilities.length === 0 && (
              <div className="assessment-empty-state">
                <MapPin aria-hidden="true" size={23} />
                <h3>No facilities found for this search.</h3>
                <p>Try a nearby town or a broader specialty search.</p>
              </div>
            )}

            {facilities.length > 0 && (
              <FacilityResults
                facilities={facilities}
                locationLabel={locationLabel || place}
                selectedIndex={selectedFacilityIndex}
                onSelect={setSelectedFacilityIndex}
              />
            )}
          </div>

          <aside className="assessment-side-panel">
            <div className="assessment-preview">
              <p className="assessment-side-kicker"><span className="live-dot" /> NEARBY CARE</p>
              <div className="assessment-report-illustration" aria-hidden="true">
                <MapPin size={42} strokeWidth={1.4} />
              </div>
              <h2>Start with your location.</h2>
              <p>Facility details and distance are provided by the ENT location service. External listings may not be verified.</p>
            </div>
            <div className="assessment-side-note">
              <span className="assessment-note-mark" aria-hidden="true">i</span>
              <p>
                <strong>Need urgent care?</strong>
                <span>If you have severe or rapidly worsening symptoms, contact emergency services or go to the nearest emergency department.</span>
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
