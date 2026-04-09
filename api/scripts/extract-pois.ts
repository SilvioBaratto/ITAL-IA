/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Extract structured POIs from the deep-research KB.
 *
 * Source layout:
 *   kb/{region-slug}/{CATEGORY}/.comuni/{comune-slug}.md
 *   kb/{region-slug}/comuni.csv
 *
 * Output layout:
 *   kb/{region-slug}/{CATEGORY}/.database/pois.json
 *
 * Each output file is a concatenated list of POIs extracted from every
 * comune markdown in that (region, category) pair, via BAML
 * `ExtractPois`. The JSON shape is aligned with the `points_of_interest`
 * Prisma table — `api/scripts/populate-pois.ts` reads these files and
 * upserts rows directly.
 *
 * The script is additive: re-running skips files already processed
 * (tracked in `kb/{region}/{CATEGORY}/.database/.progress.json`) unless
 * you pass `--force`. At the end it rebuilds `pois.json` from every
 * per-comune JSON on disk, so partial runs still yield a consistent
 * aggregate file.
 *
 * Usage:
 *   cd api
 *   npx ts-node -r tsconfig-paths/register scripts/extract-pois.ts
 *   npx ts-node -r tsconfig-paths/register scripts/extract-pois.ts --region friuli-venezia-giulia
 *   npx ts-node -r tsconfig-paths/register scripts/extract-pois.ts --region friuli-venezia-giulia --category RESTAURANT
 *   npx ts-node -r tsconfig-paths/register scripts/extract-pois.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/extract-pois.ts --force
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } = fs;
const { join, basename } = path;

dotenv.config({ path: join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..');
const KB_DIR = join(ROOT, 'kb');

const CONCURRENCY = 2;
const DELAY_MS = 2000;
const MIN_FILE_BYTES = 200;

// ---------------------------------------------------------------------------
// Types — mirror ExtractedPoi from baml_client, plus comune provenance
// ---------------------------------------------------------------------------

/**
 * Shape of a single POI in the output JSON. The first 9 fields map 1:1
 * onto `points_of_interest` columns; `region_id` and `category` are
 * kept at the file header level, not per-POI, because they're constant
 * within one .database/pois.json file. `comune_name` and `province`
 * are kept per-POI as provenance metadata — the populator doesn't write
 * them to the DB (no column), but they're useful for debugging and for
 * future linking to the `comuni` table.
 */
interface PoiRecord {
  name: string;
  address: string | null;
  website_url: string | null;
  maps_url: string | null;
  image_url: string | null;
  description: string | null;
  // Provenance (not DB columns)
  comune_name: string;
  province: string | null;
  source_file: string;
}

interface DatabaseFile {
  region_id: string;
  category: string;
  generated_at: string;
  source_comuni: string[];
  count: number;
  pois: PoiRecord[];
}

interface SourceFile {
  filePath: string;
  region: string;
  category: string;
  comuneSlug: string;
  comuneName: string;
  province: string | null;
}

interface ProgressEntry {
  processed_at: string;
  poi_count: number;
}
type ProgressMap = Record<string, ProgressEntry>;

interface CliOptions {
  region: string | null;
  category: string | null;
  force: boolean;
  dryRun: boolean;
}

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const opts: CliOptions = { region: null, category: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--region') opts.region = argv[++i];
    else if (a === '--category') opts.category = argv[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Helpers (shared in spirit with chunk-kb.ts — kept duplicated for now
// because this script is standalone and the helpers are small; if more
// scripts grow that need them, factor out to `api/scripts/_kb-common.ts`)
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const ITALIAN_LOWERCASE_WORDS = new Set([
  'di', 'del', 'della', 'dello', 'dei', 'delle', 'degli',
  'da', 'dal', 'dalla', 'dallo', 'dai', 'dalle', 'dagli',
  'a', 'al', 'alla', 'allo', 'ai', 'alle', 'agli',
  'in', 'nel', 'nella', 'nello', 'nei', 'nelle', 'negli',
  'con', 'su', 'sul', 'sulla', 'sullo', 'sui', 'sulle', 'sugli',
  'e', 'ed', 'o',
]);

function deslugifyComune(slug: string): string {
  const parts = slug.split('-');
  return parts
    .map((word, idx) => {
      if (idx > 0 && ITALIAN_LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function loadComuniCsv(region: string): Map<string, string> {
  const csvPath = join(KB_DIR, region, 'comuni.csv');
  const map = new Map<string, string>();
  if (!existsSync(csvPath)) return map;

  const lines = readFileSync(csvPath, 'utf-8').split('\n').slice(1);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, province] = trimmed.split(',');
    if (name && province) {
      map.set(name.trim().toLowerCase(), province.trim());
    }
  }
  return map;
}

function clampString(s: string | null | undefined, max: number): string | null {
  if (s === null || s === undefined) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Build a Google Maps "search" URL from the POI name and, if available,
 * its address. This is the format documented in
 * https://developers.google.com/maps/documentation/urls/get-started
 * under "Search action":
 *
 *   https://www.google.com/maps/search/?api=1&query=<url-encoded query>
 *
 * Rules we care about:
 *  - `api=1` is required
 *  - the query is a free-form string (name, address, city…)
 *  - commas and spaces must be percent-encoded — `encodeURIComponent`
 *    handles that plus accented Italian characters
 *  - hard URL limit is 2048 chars; our "name, address" queries are far
 *    below that, but clamp defensively anyway
 *
 * Field values the LLM extracted aren't touched; we just derive this
 * URL alongside them. The alternative (asking the LLM to produce the
 * URL) was wasting tokens and almost always returning null because the
 * source markdown rarely has a real maps link.
 */
const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

function buildMapsUrl(name: string, address: string | null, comuneName: string): string | null {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) return null;
  // Prefer "name, address" when we have both — it's the most specific
  // query and Google Maps usually lands on the exact pin. Fall back to
  // "name, comune" when we only have the comune, which still narrows
  // the search region. Never just the bare name — too ambiguous.
  const query = address && address.trim().length > 0
    ? `${trimmedName}, ${address.trim()}`
    : `${trimmedName}, ${comuneName.trim()}`;
  const encoded = encodeURIComponent(query);
  const url = `${MAPS_SEARCH_BASE}${encoded}`;
  return url.length > 1000 ? url.slice(0, 1000) : url;
}

// ---------------------------------------------------------------------------
// Discover source files
// ---------------------------------------------------------------------------
function discoverSources(opts: CliOptions): SourceFile[] {
  const sources: SourceFile[] = [];
  if (!existsSync(KB_DIR)) return sources;

  const regions = readdirSync(KB_DIR).filter((d) => {
    if (opts.region && d !== opts.region) return false;
    const p = join(KB_DIR, d);
    return statSync(p).isDirectory() && d !== 'chunked';
  });

  for (const region of regions) {
    const regionDir = join(KB_DIR, region);
    const provinceMap = loadComuniCsv(region);

    const categories = readdirSync(regionDir).filter((d) => {
      if (opts.category && d !== opts.category) return false;
      const p = join(regionDir, d);
      return statSync(p).isDirectory() && d === d.toUpperCase();
    });

    for (const category of categories) {
      const comuniDir = join(regionDir, category, '.comuni');
      if (!existsSync(comuniDir)) continue;

      const mds = readdirSync(comuniDir).filter((f) => f.endsWith('.md'));
      for (const md of mds) {
        const comuneSlug = basename(md, '.md');
        const comuneName = deslugifyComune(comuneSlug);
        const province = provinceMap.get(comuneName.toLowerCase()) ?? null;
        sources.push({
          filePath: join(comuniDir, md),
          region,
          category,
          comuneSlug,
          comuneName,
          province,
        });
      }
    }
  }

  return sources.sort((a, b) =>
    (a.region + a.category + a.comuneSlug).localeCompare(b.region + b.category + b.comuneSlug),
  );
}

// ---------------------------------------------------------------------------
// Per-category state: database dir + progress file + per-comune cache
// ---------------------------------------------------------------------------
function databaseDirFor(region: string, category: string): string {
  return join(KB_DIR, region, category, '.database');
}
function progressPathFor(region: string, category: string): string {
  return join(databaseDirFor(region, category), '.progress.json');
}
function comuneCachePathFor(region: string, category: string, comuneSlug: string): string {
  return join(databaseDirFor(region, category), '.comuni', `${comuneSlug}.json`);
}
function aggregatePathFor(region: string, category: string): string {
  return join(databaseDirFor(region, category), 'pois.json');
}

function loadProgress(region: string, category: string): ProgressMap {
  const p = progressPathFor(region, category);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf-8'));
}
function saveProgress(region: string, category: string, progress: ProgressMap): void {
  const p = progressPathFor(region, category);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify(progress, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Process a single source file
// ---------------------------------------------------------------------------
type BamlClient = typeof import('../baml_client').b;

async function processFile(
  source: SourceFile,
  b: BamlClient,
): Promise<PoiRecord[] | null> {
  const raw = readFileSync(source.filePath, 'utf-8');

  if (Buffer.byteLength(raw, 'utf-8') < MIN_FILE_BYTES) {
    console.log(
      `  SKIP (< ${MIN_FILE_BYTES} bytes): ${source.region}/${source.category}/${source.comuneSlug}`,
    );
    return null;
  }

  const result = await b.ExtractPois(source.comuneName, source.category, raw);
  const relSourceFile = `kb/${source.region}/${source.category}/.comuni/${source.comuneSlug}.md`;

  return (result.pois ?? [])
    .map((p): PoiRecord => {
      // Clamp to the VarChar lengths from prisma/schema.prisma so the
      // populator's insert never trips a 22001 truncation error.
      const name = (clampString(p.name, 500) ?? '').slice(0, 500);
      const address = clampString(p.address ?? null, 500);
      return {
        name,
        address,
        website_url: clampString(p.website_url ?? null, 1000),
        // maps_url is derived, not extracted — BAML dropped the field.
        maps_url: buildMapsUrl(name, address, source.comuneName),
        image_url: clampString(p.image_url ?? null, 1000),
        description: clampString(p.description ?? null, 100_000),
        comune_name: source.comuneName,
        province: source.province,
        source_file: relSourceFile,
      };
    })
    .filter((poi) => poi.name.length > 0);
}

// ---------------------------------------------------------------------------
// Rebuild pois.json from all per-comune cache files on disk.
// Separates "what the current run produced" from "what's on disk across
// all past runs" — so partial progress always aggregates cleanly.
// ---------------------------------------------------------------------------
function rebuildAggregate(region: string, category: string): DatabaseFile {
  const comuneCacheDir = join(databaseDirFor(region, category), '.comuni');
  const pois: PoiRecord[] = [];
  const sourceComuni: string[] = [];

  if (existsSync(comuneCacheDir)) {
    const files = readdirSync(comuneCacheDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const cache = JSON.parse(
        readFileSync(join(comuneCacheDir, f), 'utf-8'),
      ) as { pois: PoiRecord[] };
      if (Array.isArray(cache.pois)) {
        // Backfill maps_url for older caches written before we started
        // deriving it locally. Always regenerate rather than trusting
        // whatever the cache stored — the URL is a deterministic
        // function of name + address + comune and we want it consistent
        // across runs.
        for (const poi of cache.pois) {
          poi.maps_url = buildMapsUrl(poi.name, poi.address, poi.comune_name);
        }
        pois.push(...cache.pois);
        sourceComuni.push(basename(f, '.json'));
      }
    }
  }

  return {
    region_id: region,
    category,
    generated_at: new Date().toISOString(),
    source_comuni: sourceComuni.sort(),
    count: pois.length,
    pois,
  };
}

function writeAggregate(region: string, category: string, file: DatabaseFile): void {
  const outPath = aggregatePathFor(region, category);
  mkdirSync(join(outPath, '..'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const opts = parseArgs();

  const sources = discoverSources(opts);
  if (sources.length === 0) {
    console.log('No source files found. Check your --region / --category filters.');
    return;
  }

  // Group by (region, category) so we can manage progress/aggregation
  // one pair at a time.
  const byRegionCategory = new Map<string, { region: string; category: string; sources: SourceFile[] }>();
  for (const s of sources) {
    const key = `${s.region}/${s.category}`;
    const existing = byRegionCategory.get(key);
    if (existing) existing.sources.push(s);
    else byRegionCategory.set(key, { region: s.region, category: s.category, sources: [s] });
  }

  console.log(`\nKB source files: ${sources.length}`);
  console.log(`Groups (region × category): ${byRegionCategory.size}`);
  if (opts.region) console.log(`Region filter: ${opts.region}`);
  if (opts.category) console.log(`Category filter: ${opts.category}`);
  if (opts.force) console.log(`Force mode: ignoring progress file`);
  if (opts.dryRun) console.log(`Dry run: no BAML calls, no file writes`);
  console.log();

  if (opts.dryRun) {
    for (const group of byRegionCategory.values()) {
      console.log(`  ${group.region}/${group.category}: ${group.sources.length} files`);
      const sample = group.sources.slice(0, 5);
      for (const s of sample) {
        console.log(`    - ${s.comuneName} (province=${s.province ?? 'null'})`);
      }
      if (group.sources.length > 5) {
        console.log(`    ... and ${group.sources.length - 5} more`);
      }
    }
    return;
  }

  const { b } = await import('../baml_client');

  let totalProcessed = 0;
  let totalPois = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const group of byRegionCategory.values()) {
    const { region, category, sources: groupSources } = group;
    const progress = opts.force ? {} : loadProgress(region, category);

    const pending = groupSources.filter((s) => !progress[s.comuneSlug]);
    const alreadyDone = groupSources.length - pending.length;

    console.log(`\n=== ${region}/${category} ===`);
    console.log(`  Sources: ${groupSources.length} (pending: ${pending.length}, already done: ${alreadyDone})`);

    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (source) => {
          const idx = i + batch.indexOf(source) + 1;
          console.log(
            `  [${idx}/${pending.length}] ${source.comuneName}`,
          );
          return { source, pois: await processFile(source, b) };
        }),
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(`    FAIL: ${result.reason}`);
          totalFailed++;
          continue;
        }

        const { source, pois } = result.value;
        if (pois === null) {
          totalSkipped++;
          continue;
        }

        // Persist this comune's POIs to its own cache file so a later
        // aggregate rebuild picks it up without re-running the LLM.
        const cachePath = comuneCachePathFor(region, category, source.comuneSlug);
        mkdirSync(join(cachePath, '..'), { recursive: true });
        writeFileSync(
          cachePath,
          JSON.stringify(
            {
              comune_name: source.comuneName,
              province: source.province,
              source_file: `kb/${region}/${category}/.comuni/${source.comuneSlug}.md`,
              extracted_at: new Date().toISOString(),
              pois,
            },
            null,
            2,
          ),
          'utf-8',
        );

        progress[source.comuneSlug] = {
          processed_at: new Date().toISOString(),
          poi_count: pois.length,
        };
        saveProgress(region, category, progress);

        console.log(`    -> ${pois.length} POIs extracted`);
        totalProcessed++;
        totalPois += pois.length;
      }

      if (i + CONCURRENCY < pending.length) {
        await sleep(DELAY_MS);
      }
    }

    // Rebuild the aggregate for this (region, category), even if nothing
    // changed in this run — it's cheap and keeps pois.json in sync with
    // whatever's on disk.
    const aggregate = rebuildAggregate(region, category);
    writeAggregate(region, category, aggregate);
    console.log(
      `  Aggregate: ${aggregate.count} POIs across ${aggregate.source_comuni.length} comuni → ${aggregatePathFor(region, category)}`,
    );
  }

  console.log('\n========== Summary ==========');
  console.log(`Comuni processed:  ${totalProcessed}`);
  console.log(`POIs extracted:    ${totalPois}`);
  console.log(`Comuni skipped:    ${totalSkipped}`);
  console.log(`Failed:            ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
