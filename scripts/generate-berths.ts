// Generates api/Data/berths.json from CORPUS + SMART + tiplocs.json
// Downloads CORPUS and SMART from datafeeds.networkrail.co.uk using Basic Auth.
// Usage: NR_USER=... NR_PASS=... bun run scripts/generate-berths.ts

import { gunzipSync } from "zlib";

const NR_BASE = "https://datafeeds.networkrail.co.uk/ntrod/SupportingFileAuthenticate";
const user = process.env.NR_USER;
const pass = process.env.NR_PASS;

if (!user || !pass) {
  console.error("Set NR_USER and NR_PASS env vars");
  process.exit(1);
}

const auth = Buffer.from(`${user}:${pass}`).toString("base64");

async function fetchNr(type: string) {
  console.log(`Fetching ${type}...`);
  const res = await fetch(`${NR_BASE}?type=${type}`, {
    headers: { Authorization: `Basic ${auth}` },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${type} fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return JSON.parse(gunzipSync(Buffer.from(buf)).toString("utf8"));
}

const [corpusRaw, smartRaw, tiplocJson] = await Promise.all([
  fetchNr("CORPUS"),
  fetchNr("SMART"),
  Bun.file("api/Data/tiplocs.json").json(),
]);

type CorpusEntry = { STANOX: string; TIPLOC: string };
type SmartEntry  = { TD: string; FROMBERTH: string; TOBERTH: string; STANOX: string };
type TiplocEntry = { lat: number; lng: number; name: string };

const corpusData: CorpusEntry[] = corpusRaw.TIPLOCDATA;
const smartData:  SmartEntry[]  = smartRaw.BERTHDATA;
const tiplocs:    Record<string, TiplocEntry> = tiplocJson;

// STANOX -> TIPLOC (prefer entries that have a TIPLOC)
const stanoxToTiploc = new Map<string, string>();
for (const entry of corpusData) {
  if (entry.STANOX && entry.TIPLOC?.trim()) {
    stanoxToTiploc.set(entry.STANOX.padStart(5, "0"), entry.TIPLOC.trim());
  }
}

// Build berths: "TD_BERTH" -> { lat, lng }
type BerthLocation = { lat: number; lng: number };
const berths: Record<string, BerthLocation> = {};
let matched = 0, unmatched = 0;

for (const entry of smartData) {
  const stanox = entry.STANOX?.padStart(5, "0");
  if (!stanox) continue;

  const tiploc = stanoxToTiploc.get(stanox);
  if (!tiploc) { unmatched++; continue; }

  const loc = tiplocs[tiploc];
  if (!loc) { unmatched++; continue; }

  // Index both FROMBERTH and TOBERTH so any berth ID we see can be resolved
  for (const berth of [entry.FROMBERTH, entry.TOBERTH]) {
    if (berth?.trim()) {
      berths[`${entry.TD}_${berth.trim()}`] = { lat: loc.lat, lng: loc.lng };
    }
  }
  matched++;
}

console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
console.log(`Total berth entries: ${Object.keys(berths).length}`);

await Bun.write("api/Data/berths.json", JSON.stringify(berths));
console.log("Written to api/Data/berths.json");
