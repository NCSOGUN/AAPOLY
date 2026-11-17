"use client";

import { ArrowRight } from "lucide-react";
import FacilityMap from "@/components/facility-map";
import type { EntFacility } from "@/lib/ent-types";

export default function FacilityResults({
  facilities,
  locationLabel,
  selectedIndex,
  onSelect,
}: {
  facilities: EntFacility[];
  locationLabel?: string;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="assessment-map-results-layout">
      <FacilityMap
        facilities={facilities}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />
      <section className="assessment-facility-list" aria-label="Nearby facilities">
        <div className="assessment-hospital-results-heading">
          <div>
            <span className="assessment-result-index">SERVICE RESULTS</span>
            <h3>Facilities near {locationLabel || "your search"}</h3>
          </div>
          <span>{facilities.length} found</span>
        </div>
        {facilities.map((facility, index) => {
          const hasCoordinates =
            typeof facility.latitude === "number" &&
            typeof facility.longitude === "number" &&
            Number.isFinite(facility.latitude) &&
            Number.isFinite(facility.longitude) &&
            facility.latitude >= -90 &&
            facility.latitude <= 90 &&
            facility.longitude >= -180 &&
            facility.longitude <= 180;
          const query = hasCoordinates
            ? `${facility.latitude},${facility.longitude}`
            : [facility.name, facility.address, facility.city, facility.state]
                .filter(Boolean)
                .join(", ");
          const travelTimes = [
            facility.travelTimes?.driving ? `Drive ${facility.travelTimes.driving}` : null,
            facility.travelTimes?.walking ? `Walk ${facility.travelTimes.walking}` : null,
            facility.travelTimes?.motorcycle
              ? `Motorcycle ${facility.travelTimes.motorcycle}`
              : null,
          ].filter((time): time is string => Boolean(time));
          const selected = index === selectedIndex;

          return (
            <article
              className={`assessment-facility-card${selected ? " is-selected" : ""}`}
              key={facility.id ?? `${facility.name}-${index}`}
            >
              <button
                type="button"
                className="assessment-facility-select"
                aria-pressed={selected}
                onClick={() => onSelect(index)}
              >
                <span className="assessment-facility-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="assessment-facility-details">
                  <strong>{facility.name}</strong>
                  <span>
                    {[facility.address, facility.city, facility.state]
                      .filter(Boolean)
                      .join(", ") || "Address not provided"}
                  </span>
                  <span className="assessment-facility-facts">
                    {typeof facility.distanceKm === "number" &&
                      Number.isFinite(facility.distanceKm) &&
                      facility.distanceKm >= 0 && (
                      <span>{facility.distanceKm.toFixed(1)} km away</span>
                    )}
                    {facility.accredited === true && <span>Accredited</span>}
                    {facility.accredited === false && <span>Not accredited</span>}
                    {facility.verified === false && <span className="assessment-unverified">External listing · not verified</span>}
                  </span>
                  {travelTimes.length > 0 && (
                    <span className="assessment-facility-facts">
                      {travelTimes.map((time) => <span key={time}>{time}</span>)}
                    </span>
                  )}
                  {facility.matchedSpecialties?.length ? (
                    <span>Matched: {facility.matchedSpecialties.join(", ")}</span>
                  ) : facility.specialties?.length ? (
                    <span>Specialties: {facility.specialties.join(", ")}</span>
                  ) : null}
                </span>
              </button>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noreferrer"
                className="assessment-directions-link"
                aria-label={`Directions to ${facility.name}`}
              >
                Directions <ArrowRight aria-hidden="true" size={14} />
              </a>
            </article>
          );
        })}
      </section>
    </div>
  );
}
