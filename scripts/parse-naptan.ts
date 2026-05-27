// Parse NAPTAN railway stops CSV -> tiplocs.json
// ATCOCode format: 9100TIPLOC

const csv = await Bun.file("/tmp/naptan_rail.csv").text();
const lines = csv.trim().split("\n");
const headers = lines[0].split(",");

const atcoIdx = headers.indexOf("ATCOCode");
const nameIdx = headers.indexOf("CommonName");
const latIdx = headers.indexOf("Latitude");
const lonIdx = headers.indexOf("Longitude");
const statusIdx = headers.indexOf("Status");

const tiplocs: Record<string, { lat: number; lng: number; name: string }> = {};

for (const line of lines.slice(1)) {
  const cols = line.split(",");
  const atco = cols[atcoIdx];
  const status = cols[statusIdx];

  if (!atco?.startsWith("9100")) continue;
  if (status === "del") continue;

  const tiploc = atco.slice(4);
  const name = cols[nameIdx]?.replace(/\s+Rail\s+Station$/i, "").replace(/\s+Railway\s+Station$/i, "").trim() ?? tiploc;
  const lat = parseFloat(cols[latIdx]);
  const lng = parseFloat(cols[lonIdx]);

  if (isNaN(lat) || isNaN(lng)) continue;

  tiplocs[tiploc] = { lat, lng, name };
}

console.log(`Parsed ${Object.keys(tiplocs).length} tiplocs`);
await Bun.write("api/Data/tiplocs.json", JSON.stringify(tiplocs));
console.log("Written to api/Data/tiplocs.json");
