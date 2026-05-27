"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { TrainPosition } from "@/types/train";

interface Props {
  trains: TrainPosition[];
  selectedTrain: TrainPosition | null;
  onSelectTrain?: (rid: string | null) => void;
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
  return Math.max(3, Math.min(14, (zoom - 3) * 1.4));
}

function TrainFollower({ train }: { train: TrainPosition | null }) {
  const map = useMap();
  const prevRidRef = useRef<string | null>(null);
  const prevLatRef = useRef<number | null>(null);
  const prevLngRef = useRef<number | null>(null);

  useEffect(() => {
    if (!train) {
      prevRidRef.current = null;
      prevLatRef.current = null;
      prevLngRef.current = null;
      return;
    }

    const isNewSelection = train.rid !== prevRidRef.current;
    const hasMoved =
      train.lat !== prevLatRef.current || train.lng !== prevLngRef.current;

    prevRidRef.current = train.rid;
    prevLatRef.current = train.lat;
    prevLngRef.current = train.lng;

    if (isNewSelection) {
      map.flyTo([train.lat, train.lng], Math.max(map.getZoom(), 12), {
        duration: 1.4,
        easeLinearity: 0.2,
      });
    } else if (hasMoved) {
      map.flyTo([train.lat, train.lng], map.getZoom(), {
        duration: 0.6,
        easeLinearity: 0.5,
        noMoveStart: true,
      });
    }
  }, [train, map]);

  return null;
}

export default function Map({ trains, selectedTrain, onSelectTrain }: Props) {
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
      <TrainFollower train={selectedTrain} />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {trains.map((train) => {
        const color = delayColor(train.delayMinutes);
        const isSelected = train.rid === selectedTrain?.rid;
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
