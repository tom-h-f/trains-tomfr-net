"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTrains } from "@/hooks/useTrains";
import Sidebar from "./Sidebar";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, background: "var(--bg, #faf4e4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--muted, #6e6762)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Loading map…
      </span>
    </div>
  ),
});

export default function TrainMap() {
  const { trains, connected } = useTrains();
  const [filter, setFilter] = useState("");
  const [selectedRid, setSelectedRid] = useState<string | null>(null);

  const passengerTrains = useMemo(
    () => new globalThis.Map([...trains.entries()].filter(([, t]) => t.destination)),
    [trains]
  );

  const visibleTrains = useMemo(
    () => filter
      ? [...passengerTrains.values()].filter(
          (t) =>
            t.headcode?.toLowerCase().includes(filter.toLowerCase()) ||
            t.toc?.toLowerCase().includes(filter.toLowerCase()) ||
            t.destination?.toLowerCase().includes(filter.toLowerCase())
        )
      : [...passengerTrains.values()],
    [passengerTrains, filter]
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <Sidebar
        trains={passengerTrains}
        connected={connected}
        filter={filter}
        onFilterChange={setFilter}
        selectedRid={selectedRid}
        onSelectRid={setSelectedRid}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <Map
          trains={visibleTrains}
          selectedRid={selectedRid}
          onSelectRid={setSelectedRid}
        />
      </div>
    </div>
  );
}
