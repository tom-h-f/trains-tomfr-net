// Fetches tiploc->lat/lng from Overpass API (OSM) using railway=station + ref:tiploc tag.
// Run: bun run scripts/fetch-tiplocs.ts

export {}

const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";

const query = `
[out:json][timeout:60];
(
  node["railway"="station"]["ref:tiploc"];
  node["railway"="halt"]["ref:tiploc"];
  node["railway"="junction"]["ref:tiploc"];
  node["railway"="stop"]["ref:tiploc"];
);
out body;
`;

console.log("Fetching tiploc locations from OpenStreetMap...");

const params = new URLSearchParams({ data: query });
const res = await fetch(`${OVERPASS_URL}?${params}`);

if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

const data = await res.json() as {
  elements: Array<{
    lat: number;
    lon: number;
    tags: Record<string, string>;
  }>;
};

const tiplocs: Record<string, { lat: number; lng: number; name: string }> = {};

for (const el of data.elements) {
  const tiploc = el.tags["ref:tiploc"];
  if (!tiploc) continue;

  const name = el.tags["name"] ?? el.tags["official_name"] ?? tiploc;

  // Some stations have multiple tiplocs (space-separated)
  for (const t of tiploc.split(" ")) {
    tiplocs[t.trim()] = { lat: el.lat, lng: el.lon, name };
  }
}

console.log(`Found ${Object.keys(tiplocs).length} tiplocs`);

await Bun.write("api/Data/tiplocs.json", JSON.stringify(tiplocs, null, 2));
console.log("Written to api/Data/tiplocs.json");
