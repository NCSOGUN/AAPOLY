"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export interface MapPickerProps {
  latitude: number;
  longitude: number;
  hasPin: boolean;
  onSelect: (latitude: number, longitude: number) => void;
}

const markerIcon = L.divIcon({
  className: "facility-map-marker",
  html: '<span class="facility-map-marker-dot"></span>',
  iconSize: [28, 38],
  iconAnchor: [14, 38],
});

export function MapPicker({
  latitude,
  longitude,
  hasPin,
  onSelect,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialViewRef = useRef({
    latitude,
    longitude,
    hasPin,
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialView = initialViewRef.current;
    const map = L.map(container, { scrollWheelZoom: true }).setView(
      [initialView.latitude, initialView.longitude],
      initialView.hasPin ? 15 : 8
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      onSelectRef.current(event.latlng.lat, event.latlng.lng);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setView([latitude, longitude], hasPin ? 15 : 8, { animate: true });

    if (!hasPin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([latitude, longitude], {
        icon: markerIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current.on("dragend", () => {
        const position = markerRef.current?.getLatLng();
        if (position) {
          onSelectRef.current(position.lat, position.lng);
        }
      });
      return;
    }

    markerRef.current.setLatLng([latitude, longitude]);
  }, [hasPin, latitude, longitude]);

  return <div ref={containerRef} className="h-full w-full" />;
}
