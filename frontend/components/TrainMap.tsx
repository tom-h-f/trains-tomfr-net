"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTrains } from "@/hooks/useTrains";
import Sidebar from "./Sidebar";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151", letterSpacing: "0.1em" }}>
        LOADING MAP…
      </span>
    </div>
  ),
});

export default function TrainMap() {
  const { trains, connected } = useTrains();
  const [filter, setFilter] = useState("");
  const [selectedRid, setSelectedRid] = useState<string | null>(null);

  const visibleTrains = filter
    ? [...trains.values()].filter(
        (t) =>
          t.headcode?.toLowerCase().includes(filter.toLowerCase()) ||
          t.toc?.toLowerCase().includes(filter.toLowerCase()) ||
          t.destination?.toLowerCase().includes(filter.toLowerCase())
      )
    : [...trains.values()];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <Sidebar
        trains={trains}
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
          onSelectTrain={setSelectedRid}
        />
      </div>
    </div>
  );
}
