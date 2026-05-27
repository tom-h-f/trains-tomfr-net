"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { TrainPosition } from "@/types/train";

interface Props {
  trains: TrainPosition[];
}

function delayColor(delay: number): string {
  if (delay <= 0) return "#22c55e";
  if (delay <= 5) return "#f59e0b";
  return "#ef4444";
}

export default function Map({ trains }: Props) {
  return (
    <MapContainer
      center={[54.0, -2.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {trains.map((train) => (
        <CircleMarker
          key={train.rid}
          center={[train.lat, train.lng]}
          radius={7}
          pathOptions={{
            color: delayColor(train.delayMinutes),
            fillColor: delayColor(train.delayMinutes),
            fillOpacity: 0.9,
            weight: 1,
          }}
        >
          <Tooltip>
            <div className="text-xs leading-4">
              <div className="font-bold">{train.headcode ?? train.rid}</div>
              {train.toc && <div>{train.toc}</div>}
              {train.destination && <div>to {train.destination}</div>}
              {train.delayMinutes !== 0 && (
                <div
                  style={{ color: delayColor(train.delayMinutes) }}
                >
                  {train.delayMinutes > 0 ? `+${train.delayMinutes}` : train.delayMinutes} min
                </div>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
