"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTrains } from "@/hooks/useTrains";
import FilterPanel from "./FilterPanel";

const Map = dynamic(() => import("./Map"), { ssr: false });

export default function TrainMap() {
  const { trains, connected } = useTrains();
  const [filter, setFilter] = useState("");

  const visibleTrains = filter
    ? [...trains.values()].filter(
        (t) =>
          t.headcode?.toLowerCase().includes(filter.toLowerCase()) ||
          t.toc?.toLowerCase().includes(filter.toLowerCase()) ||
          t.destination?.toLowerCase().includes(filter.toLowerCase())
      )
    : [...trains.values()];

  return (
    <div className="relative h-screen w-screen">
      <Map trains={visibleTrains} />

      <FilterPanel
        filter={filter}
        onFilterChange={setFilter}
        trainCount={visibleTrains.length}
        totalCount={trains.size}
        connected={connected}
      />
    </div>
  );
}
