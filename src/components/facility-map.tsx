"use client";

import dynamic from "next/dynamic";
import type { EntFacility } from "@/lib/ent-types";

const LeafletFacilityMap = dynamic(() => import("@/components/leaflet-facility-map"), {
  ssr: false,
  loading: () => (
    <div className="facility-map-loading" role="status">
      Loading facility map…
    </div>
  ),
});

export default function FacilityMap({
  facilities,
  selectedIndex,
  onSelect,
}: {
  facilities: EntFacility[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="assessment-facility-map" aria-label="Facility map">
      <LeafletFacilityMap
        facilities={facilities}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />
    </div>
  );
}
