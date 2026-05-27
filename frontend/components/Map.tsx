"use client";

import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import type { TrainPosition } from "@/types/train";

interface Props {
  trains: TrainPosition[];
  onSelectTrain?: (rid: string | null) => void;
  selectedRid?: string | null;
}

function delayColor(delay: number): string {
  if (delay <= 0) return "#4ade80";
  if (delay <= 5) return "#fbbf24";
  return "#f87171";
}

function ZoomWatcher({ onChange }: { onChange: (z: number) => void }) {
  useMapEvents({ zoom: (e) => onChange(e.target.getZoom()) });
  return null;
}

function radiusForZoom(zoom: number): number {
  // Scale smoothly: small dots at overview, larger at street level
  return Math.max(3, Math.min(14, (zoom - 3) * 1.4));
}

export default function Map({ trains, onSelectTrain, selectedRid }: Props) {
  const [zoom, setZoom] = useState(6);
  const radius = radiusForZoom(zoom);

  return (
    <MapContainer
      center={[54.0, -2.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      <ZoomWatcher onChange={setZoom} />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {trains.map((train) => {
        const color = delayColor(train.delayMinutes);
        const isSelected = train.rid === selectedRid;
        return (
          <CircleMarker
            key={train.rid}
            center={[train.lat, train.lng]}
            radius={isSelected ? radius + 3 : radius}
            pathOptions={{
              color: isSelected ? "#fff" : color,
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.85,
              weight: isSelected ? 2 : 0.8,
            }}
            eventHandlers={{
              click: () => onSelectTrain?.(isSelected ? null : train.rid),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, letterSpacing: "0.05em" }}>
                  {train.headcode ?? train.rid}
                </div>
                {train.toc && <div style={{ color: "#9ca3af" }}>{train.toc}</div>}
                {train.destination && <div>→ {train.destination}</div>}
                {train.delayMinutes !== 0 && (
                  <div style={{ color }}>
                    {train.delayMinutes > 0 ? `+${train.delayMinutes}` : train.delayMinutes} min
                  </div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
