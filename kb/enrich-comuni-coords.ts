/**
 * Enrich comuni.csv files with latitude/longitude from Wikidata SPARQL.
 * Falls back to Nominatim for unmatched comuni.
 *
 * Usage:
 *   npx tsx enrich-comuni-coords.ts                  # All regions
 *   npx tsx enrich-comuni-coords.ts piemonte          # Single region
 *   npx tsx enrich-comuni-coords.ts --skip-existing   # Skip if coords already present
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const REGION_NAME_TO_ID: Record<string, string> = {
  'abruzzo': 'abruzzo',
  'basilicata': 'basilicata',
  'calabria': 'calabria',
  'campania': 'campania',
  'emilia-romagna': 'emilia-romagna',
  'emilia romagna': 'emilia-romagna',
  'friuli venezia giulia': 'friuli-venezia-giulia',
  'friuli-venezia giulia': 'friuli-venezia-giulia',
  'lazio': 'lazio',
  'liguria': 'liguria',
  'lombardia': 'lombardia',
  'marche': 'marche',
  'molise': 'molise',
  'piemonte': 'piemonte',
  'puglia': 'puglia',
  'sardegna': 'sardegna',
  'sicilia': 'sicilia',
  'toscana': 'toscana',
  'trentino-alto adige': 'trentino-alto-adige',
  'trentino-alto adige/sudtirol': 'trentino-alto-adige',
  'trentino alto adige': 'trentino-alto-adige',
  'trentino alto adige/sudtirol': 'trentino-alto-adige',
  'umbria': 'umbria',
  "valle d'aosta": 'valle-d-aosta',
  "valle d'aosta/vallee d'aoste": 'valle-d-aosta',
  'veneto': 'veneto',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, "'")
    .trim();
}

// ─── Wikidata SPARQL ─────────────────────────────────────────────────────────

// Simple query: just get all Italian comuni with coordinates (no region hierarchy)
const SPARQL_QUERY = `
SELECT ?comuneLabel ?lat ?lon WHERE {
  ?comune wdt:P31 wd:Q747074 .
  ?comune wdt:P625 ?coord .
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it" . }
}
`;

interface WikidataResult {
  comuneLabel: { value: string };
  lat: { value: string };
  lon: { value: string };
}

interface Coordinate {
  lat: number;
  lon: number;
}

async function fetchWikidataComuni(): Promise<Map<string, Coordinate>> {
  console.log('Fetching coordinates from Wikidata SPARQL...');

  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(SPARQL_QUERY.trim())}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'ITAL-IA-KB-Enricher/1.0 (https://italia.silviobaratto.com)',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL failed: HTTP ${res.status} — ${await res.text()}`);
  }

  const data = await res.json();
  const results: WikidataResult[] = data.results.bindings;
  console.log(`  Received ${results.length} results from Wikidata`);

  // Build lookup by normalized name only (most comune names are unique in Italy)
  const map = new Map<string, Coordinate>();

  for (const r of results) {
    const comuneName = normalize(r.comuneLabel.value);
    const lat = parseFloat(r.lat.value);
    const lon = parseFloat(r.lon.value);

    if (!isNaN(lat) && !isNaN(lon) && comuneName) {
      map.set(comuneName, { lat, lon });
    }
  }

  console.log(`  Built lookup with ${map.size} entries\n`);
  return map;
}

// ─── Nominatim Fallback ──────────────────────────────────────────────────────

async function geocodeNominatim(name: string, province: string): Promise<Coordinate | null> {
  const query = `${name}, ${province}, Italy`;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=it`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ITAL-IA-KB-Enricher/1.0 (https://italia.silviobaratto.com)',
      },
    });

    if (!res.ok) return null;

    const results = await res.json();
    if (results.length === 0) return null;

    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    return isNaN(lat) || isNaN(lon) ? null : { lat, lon };
  } catch {
    return null;
  }
}

// ─── CSV Processing ──────────────────────────────────────────────────────────

interface ComuneRow {
  name: string;
  province: string;
  latitude?: string;
  longitude?: string;
}

function readComuniCSV(path: string): ComuneRow[] {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');
  const hasCoords = header.includes('latitude');

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const parts = line.split(',');
    const row: ComuneRow = {
      name: parts[0]?.trim() || '',
      province: parts[1]?.trim() || '',
    };
    if (hasCoords) {
      row.latitude = parts[2]?.trim() || '';
      row.longitude = parts[3]?.trim() || '';
    }
    return row;
  });
}

function writeComuniCSV(path: string, rows: ComuneRow[]): void {
  let csv = 'name,province,latitude,longitude\n';
  for (const r of rows) {
    csv += `${r.name},${r.province},${r.latitude || ''},${r.longitude || ''}\n`;
  }
  writeFileSync(path, csv, 'utf-8');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipExisting = args.includes('--skip-existing');
  const regionFilter = args.find(a => !a.startsWith('--'));

  // Step 1: Fetch Wikidata coordinates
  const wikidataMap = await fetchWikidataComuni();

  // Step 2: Process each region
  const regionDirs = readdirSync(__dirname, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name)
    .filter(d => existsSync(join(__dirname, d, 'comuni.csv')));

  if (regionFilter) {
    if (!regionDirs.includes(regionFilter)) {
      console.error(`Region not found: ${regionFilter}`);
      console.error(`Available: ${regionDirs.join(', ')}`);
      process.exit(1);
    }
  }

  const regions = regionFilter ? [regionFilter] : regionDirs.sort();
  const nominatimQueue: { name: string; province: string; regionId: string; idx: number }[] = [];
  const regionResults: { region: string; total: number; matched: number }[] = [];

  // Track all rows per region for later Nominatim update
  const allRegionRows = new Map<string, ComuneRow[]>();

  for (const regionId of regions) {
    const csvPath = join(__dirname, regionId, 'comuni.csv');
    const rows = readComuniCSV(csvPath);

    if (skipExisting && rows[0]?.latitude) {
      console.log(`[${regionId}] SKIP (already has coordinates)`);
      continue;
    }

    let matched = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = normalize(row.name);
      const coord = wikidataMap.get(key);

      if (coord) {
        row.latitude = coord.lat.toFixed(6);
        row.longitude = coord.lon.toFixed(6);
        matched++;
      } else {
        // Queue for Nominatim
        nominatimQueue.push({ name: row.name, province: row.province, regionId, idx: i });
      }
    }

    allRegionRows.set(regionId, rows);
    const pct = rows.length > 0 ? Math.round((matched / rows.length) * 100) : 0;
    console.log(`[${regionId}] ${matched}/${rows.length} matched from Wikidata (${pct}%)`);
    regionResults.push({ region: regionId, total: rows.length, matched });
  }

  // Step 3: Nominatim fallback for unmatched
  if (nominatimQueue.length > 0) {
    console.log(`\nFalling back to Nominatim for ${nominatimQueue.length} unmatched comuni (1 req/sec)...\n`);

    let nominatimMatched = 0;
    for (let i = 0; i < nominatimQueue.length; i++) {
      const item = nominatimQueue[i];
      const rows = allRegionRows.get(item.regionId);
      if (!rows) continue;

      if (i > 0) await sleep(1100); // Respect Nominatim rate limit

      const coord = await geocodeNominatim(item.name, item.province);
      if (coord) {
        rows[item.idx].latitude = coord.lat.toFixed(6);
        rows[item.idx].longitude = coord.lon.toFixed(6);
        nominatimMatched++;
        if (i % 20 === 0 || i === nominatimQueue.length - 1) {
          process.stdout.write(`\r  Nominatim: ${i + 1}/${nominatimQueue.length} queried, ${nominatimMatched} resolved`);
        }
      } else {
        console.log(`  ✗ ${item.name} (${item.province}) — not found`);
      }
    }
    console.log(`\n  Nominatim resolved ${nominatimMatched}/${nominatimQueue.length}\n`);
  }

  // Step 4: Write updated CSVs
  for (const [regionId, rows] of allRegionRows) {
    const csvPath = join(__dirname, regionId, 'comuni.csv');
    writeComuniCSV(csvPath, rows);
  }

  // Step 5: Summary
  console.log('========== Summary ==========');
  let totalComuni = 0;
  let totalMatched = 0;
  let totalMissing = 0;

  for (const regionId of regions) {
    const rows = allRegionRows.get(regionId);
    if (!rows) continue;

    const withCoords = rows.filter(r => r.latitude && r.longitude).length;
    const missing = rows.length - withCoords;
    totalComuni += rows.length;
    totalMatched += withCoords;
    totalMissing += missing;

    const pct = rows.length > 0 ? Math.round((withCoords / rows.length) * 100) : 0;
    const status = missing > 0 ? ` (${missing} missing)` : '';
    console.log(`  ${regionId}: ${withCoords}/${rows.length} (${pct}%)${status}`);
  }

  console.log(`\nTotal: ${totalMatched}/${totalComuni} comuni with coordinates (${Math.round((totalMatched / totalComuni) * 100)}%)`);
  if (totalMissing > 0) {
    console.log(`Missing: ${totalMissing} comuni without coordinates`);

    // List missing comuni
    console.log('\nMissing comuni:');
    for (const [regionId, rows] of allRegionRows) {
      for (const r of rows) {
        if (!r.latitude || !r.longitude) {
          console.log(`  ${regionId}: ${r.name} (${r.province})`);
        }
      }
    }
  }
}

main().catch(console.error);
