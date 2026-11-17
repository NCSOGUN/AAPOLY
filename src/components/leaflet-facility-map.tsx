"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import type { EntFacility } from "@/lib/ent-types";

type FacilityPoint = {
  facility: EntFacility;
  index: number;
  position: [number, number];
};

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function MapViewport({
  points,
  selectedIndex,
}: {
  points: FacilityPoint[];
  selectedIndex: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      const selectedPoint = points.find((point) => point.index === selectedIndex);
      if (selectedPoint) {
        map.flyTo(selectedPoint.position, Math.max(map.getZoom(), 15), { duration: 0.35 });
      } else if (points.length > 1) {
        map.fitBounds(
          points.map((point) => point.position),
          { padding: [28, 28], maxZoom: 15 },
        );
      } else if (points.length === 1) {
        map.setView(points[0].position, 13);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [map, points, selectedIndex]);

  return null;
}

function markerIcon(index: number, selected: boolean) {
  return L.divIcon({
    className: "facility-map-marker-shell",
    html: `<span class="facility-map-marker${selected ? " is-selected" : ""}">${index + 1}</span>`,
    iconSize: [30, 36],
    iconAnchor: [15, 34],
  });
}

export default function LeafletFacilityMap({
  facilities,
  selectedIndex,
  onSelect,
}: {
  facilities: EntFacility[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const points = useMemo(
    () =>
      facilities.flatMap((facility, index) =>
        typeof facility.latitude === "number" &&
        typeof facility.longitude === "number" &&
        isValidCoordinate(facility.latitude, facility.longitude)
          ? [{ facility, index, position: [facility.latitude, facility.longitude] as [number, number] }]
          : [],
      ),
    [facilities],
  );
  const center: LatLngExpression = points[0]?.position ?? [9.082, 8.6753];

  if (!points.length) {
    return (
      <div className="facility-map-unavailable" role="status">
        <span>MAP UNAVAILABLE</span>
        <p>These facility results do not include map coordinates. Use the directions links to locate them.</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={6}
      scrollWheelZoom={false}
      className="facility-leaflet-map"
      aria-label="Map showing nearby facilities"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport points={points} selectedIndex={selectedIndex} />
      {points.map(({ facility, index, position }) => (
        <Marker
          key={facility.id ?? `${facility.name}-${index}`}
          position={position}
          icon={markerIcon(index, index === selectedIndex)}
          title={`${index + 1}. ${facility.name}`}
          eventHandlers={{ click: () => onSelect(index) }}
        >
          <Popup>
            <strong>{index + 1}. {facility.name}</strong>
            <br />
            {[facility.address, facility.city, facility.state].filter(Boolean).join(", ")}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
