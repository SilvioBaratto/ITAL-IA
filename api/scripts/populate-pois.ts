/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Populate the `points_of_interest` table from the extracted JSON files.
 *
 * Reads every `kb/{region}/{CATEGORY}/.database/pois.json` produced by
 * `api/scripts/extract-pois.ts`, validates each POI against the Prisma
 * schema, and upserts it using the `(name, comuneId, category)` composite
 * unique key. POIs now link to the `comuni` table rather than to `regions`
 * directly — region is reached via `POI → Comune → Region`.
 *
 * The caller's pois.json still carries `region_id` at the file header
 * and `comune_name` per POI. We resolve `comune_name` → `comune_id` via
 * an in-memory map of the `comuni` table (loaded once per region).
 * Unmatched comune names are a hard failure — the script aborts before
 * touching the DB so you find out loud, not half-written.
 *
 * Idempotent: running twice is safe. Non-null fields from the new file
 * overwrite existing values; null fields do NOT overwrite existing
 * non-null values, so an LLM re-extraction that loses detail can't
 * silently wipe out good data.
 *
 * Usage:
 *   cd api
 *   npx ts-node -r tsconfig-paths/register scripts/populate-pois.ts
 *   npx ts-node -r tsconfig-paths/register scripts/populate-pois.ts --region friuli-venezia-giulia
 *   npx ts-node -r tsconfig-paths/register scripts/populate-pois.ts --region friuli-venezia-giulia --category RESTAURANT
 *   npx ts-node -r tsconfig-paths/register scripts/populate-pois.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient, PoiCategory } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { readFileSync, existsSync, readdirSync, statSync } = fs;
const { join } = path;

dotenv.config({ path: join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..');
const KB_DIR = join(ROOT, 'kb');
const UPSERT_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types — must stay in sync with extract-pois.ts output shape
// ---------------------------------------------------------------------------
interface PoiRecord {
  name: string;
  address: string | null;
  website_url: string | null;
  maps_url: string | null;
  image_url: string | null;
  description: string | null;
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

interface CliOptions {
  region: string | null;
  category: string | null;
  dryRun: boolean;
}

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const opts: CliOptions = { region: null, category: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--region') opts.region = argv[++i];
    else if (a === '--category') opts.category = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Discovery: find every .database/pois.json matching the filters
// ---------------------------------------------------------------------------
function discoverDatabaseFiles(opts: CliOptions): string[] {
  const paths: string[] = [];
  if (!existsSync(KB_DIR)) return paths;

  const regions = readdirSync(KB_DIR).filter((d) => {
    if (opts.region && d !== opts.region) return false;
    const p = join(KB_DIR, d);
    return statSync(p).isDirectory() && d !== 'chunked';
  });

  for (const region of regions) {
    const regionDir = join(KB_DIR, region);
    const categories = readdirSync(regionDir).filter((d) => {
      if (opts.category && d !== opts.category) return false;
      const p = join(regionDir, d);
      return statSync(p).isDirectory() && d === d.toUpperCase();
    });

    for (const category of categories) {
      const poisJson = join(regionDir, category, '.database', 'pois.json');
      if (existsSync(poisJson)) {
        paths.push(poisJson);
      }
    }
  }

  return paths.sort();
}

// ---------------------------------------------------------------------------
// Validate category string against the Prisma enum. Bad categories are
// programmer errors (not runtime data), but we validate here anyway to
// fail fast with a clear error instead of a Prisma cryptic one.
// ---------------------------------------------------------------------------
function isValidCategory(cat: string): cat is PoiCategory {
  return Object.values(PoiCategory).includes(cat as PoiCategory);
}

/**
 * Build the `update` object for a POI upsert. Only include non-null
 * fields — null means "the new extraction had no value" and we'd rather
 * preserve whatever is currently in the DB than wipe it out.
 *
 * This is the asymmetry between `create` (null is allowed, it's a first
 * insert) and `update` (null is dropped, we preserve existing data).
 */
function buildUpdateData(poi: PoiRecord): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (poi.address !== null) data.address = poi.address;
  if (poi.website_url !== null) data.websiteUrl = poi.website_url;
  if (poi.maps_url !== null) data.mapsUrl = poi.maps_url;
  if (poi.image_url !== null) data.imageUrl = poi.image_url;
  if (poi.description !== null) data.description = poi.description;
  return data;
}

function buildCreateData(poi: PoiRecord, comuneId: string, category: PoiCategory) {
  return {
    name: poi.name,
    comuneId,
    category,
    address: poi.address,
    websiteUrl: poi.website_url,
    mapsUrl: poi.maps_url,
    imageUrl: poi.image_url,
    description: poi.description,
  };
}

/**
 * Normalize a comune display name for lookup so the DB row and the
 * cached pois.json `comune_name` can be matched even when they use
 * different punctuation conventions.
 *
 * The comuni.csv (seeded into the DB) uses Italian typographic forms:
 *   "Farra d'Isonzo", "Chiopris-Viscone", "Colloredo di Monte A."
 *
 * The cached pois.json values are de-slugified from filenames like
 * `farra-d-isonzo.md`, which yields "Farra D Isonzo" — apostrophes and
 * hyphens get flattened to spaces.
 *
 * To match both shapes, we lowercase and replace every non-letter /
 * non-digit character with a single space (apostrophes → space,
 * hyphens → space, periods → space), then collapse whitespace runs and
 * trim. That way "Farra d'Isonzo" and "Farra D Isonzo" both normalize
 * to "farra d isonzo".
 *
 * The regex uses Unicode categories so Italian accents (è, ù, à) are
 * preserved as letters instead of being stripped.
 */
function normalizeComuneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ComuneLookup = Map<string, { id: string; province: string }>;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const opts = parseArgs();

  const files = discoverDatabaseFiles(opts);
  if (files.length === 0) {
    console.log('No .database/pois.json files found. Did you run extract-pois.ts first?');
    if (opts.region) console.log(`  Region filter: ${opts.region}`);
    if (opts.category) console.log(`  Category filter: ${opts.category}`);
    return;
  }

  console.log(`\nFound ${files.length} database files`);
  if (opts.region) console.log(`Region filter: ${opts.region}`);
  if (opts.category) console.log(`Category filter: ${opts.category}`);
  if (opts.dryRun) console.log(`Dry run: no DB writes`);
  console.log();

  // Parse + validate everything before touching the DB, so bad data
  // fails loudly before half the rows are inserted.
  type Parsed = { path: string; file: DatabaseFile; category: PoiCategory };
  const parsed: Parsed[] = [];
  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf-8');
    const file = JSON.parse(raw) as DatabaseFile;

    if (!file.region_id || !file.category || !Array.isArray(file.pois)) {
      console.error(`  SKIP (malformed): ${filePath}`);
      continue;
    }
    if (!isValidCategory(file.category)) {
      console.error(`  SKIP (unknown category "${file.category}"): ${filePath}`);
      continue;
    }

    parsed.push({ path: filePath, file, category: file.category });
    console.log(
      `  ${file.region_id}/${file.category}: ${file.pois.length} POIs from ${file.source_comuni.length} comuni`,
    );
  }

  if (opts.dryRun) {
    console.log('\nDry run — exiting before DB writes.');
    return;
  }

  if (parsed.length === 0) {
    console.error('\nNothing to populate (all files skipped).');
    process.exit(1);
  }

  // Connect to Postgres via the Supabase session pooler (port 5432).
  // The transaction pooler (port 6543, the default `DATABASE_URL`) hangs
  // the Prisma client on transactions — prefer DIRECT_URL here and fall
  // back to DATABASE_URL if DIRECT_URL is unset.
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter });

  let totalUpserted = 0;
  let totalFailed = 0;
  const perGroupStats: { key: string; upserted: number; failed: number }[] = [];

  try {
    await prisma.$connect();
    console.log('\nConnected to database\n');

    // Pre-flight 1: load all comuni for each referenced region into a
    // name→id lookup map, keyed by normalized (lowercased) comune name.
    // Doing this in-memory means each POI lookup is O(1) instead of a
    // DB round-trip per row.
    const distinctRegions = Array.from(new Set(parsed.map((p) => p.file.region_id)));
    const comuneMapByRegion = new Map<string, ComuneLookup>();

    for (const regionId of distinctRegions) {
      const comuni = await prisma.comune.findMany({
        where: { regionId },
        select: { id: true, name: true, province: true },
      });
      if (comuni.length === 0) {
        console.error(
          `\nERROR: no rows in the comuni table for region '${regionId}'. ` +
            `Seed the comuni table first (see scripts/seed-comuni.ts).`,
        );
        process.exit(1);
      }
      const lookup: ComuneLookup = new Map();
      for (const c of comuni) {
        lookup.set(normalizeComuneName(c.name), { id: c.id, province: c.province });
      }
      comuneMapByRegion.set(regionId, lookup);
      console.log(`  Loaded ${comuni.length} comuni for region '${regionId}'`);
    }

    // Pre-flight 2: verify every POI's comune_name actually exists in
    // the lookup map. This catches de-slugification bugs, stale KB
    // files, and missing comuni rows before any DB writes happen. Fail
    // loudly with a summary of unmatched comuni so the operator knows
    // exactly what's off.
    type Unmatched = { regionId: string; category: string; comuneName: string; poiName: string };
    const unmatched: Unmatched[] = [];
    for (const group of parsed) {
      const lookup = comuneMapByRegion.get(group.file.region_id);
      if (!lookup) continue; // already bailed above
      for (const poi of group.file.pois) {
        if (!lookup.has(normalizeComuneName(poi.comune_name))) {
          unmatched.push({
            regionId: group.file.region_id,
            category: group.category,
            comuneName: poi.comune_name,
            poiName: poi.name,
          });
        }
      }
    }
    if (unmatched.length > 0) {
      console.error(
        `\nERROR: ${unmatched.length} POIs reference comuni that don't exist in the DB.`,
      );
      // Deduplicate by unique comune name for a tidier report
      const uniqueComuni = Array.from(
        new Set(unmatched.map((u) => `${u.regionId}::${u.comuneName}`)),
      );
      console.error(`Unique unmatched comuni: ${uniqueComuni.length}`);
      for (const u of uniqueComuni.slice(0, 20)) {
        const [region, name] = u.split('::');
        console.error(`  - ${region}: "${name}"`);
      }
      if (uniqueComuni.length > 20) {
        console.error(`  ... and ${uniqueComuni.length - 20} more`);
      }
      console.error(
        '\nFix by either (a) seeding the missing comuni rows or (b) correcting the ' +
          'comune_name values in the pois.json files.',
      );
      process.exit(1);
    }

    // One group = one (region, category) pois.json file. We process
    // groups sequentially but batch their upserts inside a transaction.
    for (const group of parsed) {
      const { file, category } = group;
      const regionId = file.region_id;
      const key = `${regionId}/${category}`;
      const lookup = comuneMapByRegion.get(regionId)!;

      let upserted = 0;
      let failed = 0;

      for (let i = 0; i < file.pois.length; i += UPSERT_BATCH_SIZE) {
        const batch = file.pois.slice(i, i + UPSERT_BATCH_SIZE);
        try {
          await prisma.$transaction(
            batch.map((poi) => {
              const comuneId = lookup.get(normalizeComuneName(poi.comune_name))!.id;
              return prisma.pointOfInterest.upsert({
                where: {
                  name_comuneId_category: {
                    name: poi.name,
                    comuneId,
                    category,
                  },
                },
                create: buildCreateData(poi, comuneId, category),
                update: buildUpdateData(poi),
              });
            }),
          );
          upserted += batch.length;
        } catch (err) {
          // Fall back to one-at-a-time so one bad row doesn't nuke the
          // whole batch. We log each failure but keep going.
          for (const poi of batch) {
            try {
              const comuneId = lookup.get(normalizeComuneName(poi.comune_name))!.id;
              await prisma.pointOfInterest.upsert({
                where: {
                  name_comuneId_category: {
                    name: poi.name,
                    comuneId,
                    category,
                  },
                },
                create: buildCreateData(poi, comuneId, category),
                update: buildUpdateData(poi),
              });
              upserted++;
            } catch (rowErr) {
              console.error(`    FAIL ${key} ${JSON.stringify(poi.name)}: ${rowErr}`);
              failed++;
            }
          }
          // Keep `err` out of unused-var noise — we only care if the
          // single-row retries also fail.
          void err;
        }
      }

      perGroupStats.push({ key, upserted, failed });
      totalUpserted += upserted;
      totalFailed += failed;

      console.log(`  ${key}: ${upserted} upserted, ${failed} failed`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n========== Summary ==========');
  for (const s of perGroupStats) {
    console.log(`  ${s.key}: ${s.upserted} ok / ${s.failed} fail`);
  }
  console.log(`\nTotal upserted: ${totalUpserted}`);
  console.log(`Total failed:   ${totalFailed}`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
