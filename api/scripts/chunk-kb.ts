/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Ingest the deep-research knowledge base into `kb/chunked/`.
 *
 * Source layout:
 *   kb/{region-slug}/{CATEGORY}/.comuni/{comune-slug}.md
 *   kb/{region-slug}/comuni.csv   (name,province,latitude,longitude)
 *
 * Each per-comune file is already clean Italian markdown — typically
 * `## {comune}` followed by `### {venue}` sections. We feed the file
 * through BAML `ChunkPage` to get one-chunk-per-venue semantic chunks,
 * then flatten everything into `kb/chunked/all-chunks.json` with enough
 * metadata (region, category, comune_name, province) that the Qdrant
 * upload script doesn't have to re-parse paths.
 *
 * Replaces the old `chunk-pages.ts` which read from `kb/scraped/` — that
 * pipeline has been deleted. All runtime KB content now flows from the
 * deep-research output.
 *
 * Usage:
 *   cd api
 *   npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts
 *   npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts --region friuli-venezia-giulia
 *   npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts --region friuli-venezia-giulia --category RESTAURANT
 *   npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts --force   # ignore progress file
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } = fs;
const { join, basename, dirname } = path;

// Load .env from api/ directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..');
const KB_DIR = join(ROOT, 'kb');
const CHUNKED_DIR = join(KB_DIR, 'chunked');
const PROGRESS_PATH = join(CHUNKED_DIR, '.progress.json');
const ALL_CHUNKS_PATH = join(CHUNKED_DIR, 'all-chunks.json');

const CONCURRENCY = 2;
const DELAY_MS = 2000;
const MIN_FILE_BYTES = 200;          // per-comune files that are shorter than this are empty stubs
const LARGE_FILE_CHARS = 60_000;     // split very long comuni (unlikely) on H2 boundaries

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProgressEntry {
  processed_at: string;
  chunk_count: number;
}
type ProgressMap = Record<string, ProgressEntry>;

/**
 * FlatChunk is the handoff shape between this script and `upload-to-qdrant.ts`.
 * Keep in sync with `FlatChunk` in that file and with `ItaliaKBPayload` in
 * `src/modules/qdrant/qdrant.service.ts`.
 */
interface FlatChunk {
  chunk_id: string;
  text: string;
  page_title: string;
  page_summary: string;
  region: string;
  category: string;
  comune_name: string;
  province: string | null;
  source_url: string;
  source_file: string;
  section_title: string;
  links: { text: string; url: string }[];
  addresses: string[];
  image_urls: string[];
  opening_hours: string | null;
  prices: string | null;
  chunk_index: number;
  total_chunks_in_page: number;
}

interface ComuneRow {
  name: string;
  province: string;
}

interface SourceFile {
  filePath: string;        // absolute path
  region: string;          // slug, e.g. 'friuli-venezia-giulia'
  category: string;        // enum value, e.g. 'RESTAURANT'
  comuneSlug: string;      // filename without extension
  comuneName: string;      // de-slugified display name
  province: string | null; // joined from comuni.csv
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
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
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadProgress(): ProgressMap {
  if (existsSync(PROGRESS_PATH)) {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
  }
  return {};
}

function saveProgress(progress: ProgressMap): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

/**
 * De-slugify a comune filename into its display name.
 * `pavia-di-udine` → `Pavia di Udine`
 * `san-vito-al-tagliamento` → `San Vito al Tagliamento`
 *
 * Italian preposition/article lowercasing (di/del/della/al/e/…) is handled
 * so names look natural. This is a lossy inverse of the slugify in
 * `kb/run-deep-research.py`, but for the vast majority of comuni it
 * reproduces the correct name. Edge cases (`s-ambrogio-sul-garigliano`)
 * should be cross-checked against `comuni.csv` where possible.
 */
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

/**
 * Load `kb/{region}/comuni.csv` into a lookup map keyed by comune name.
 * Returns empty map if the file doesn't exist — province will just be null.
 */
function loadComuniCsv(region: string): Map<string, string> {
  const csvPath = join(KB_DIR, region, 'comuni.csv');
  const map = new Map<string, string>();
  if (!existsSync(csvPath)) return map;

  const lines = readFileSync(csvPath, 'utf-8').split('\n').slice(1); // skip header
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

/**
 * Split content at H2 boundaries when it exceeds LARGE_FILE_CHARS.
 * Preserves each H2 section as a single chunk-candidate so we never
 * split a venue description across batches.
 */
function splitByH2(content: string): string[] {
  if (content.length <= LARGE_FILE_CHARS) return [content];

  const sections = content.split(/(?=^## )/m);
  const batches: string[] = [];
  let current = '';

  for (const section of sections) {
    if ((current + section).length > LARGE_FILE_CHARS && current.length > 0) {
      batches.push(current.trim());
      current = section;
    } else {
      current += (current ? '\n\n' : '') + section;
    }
  }
  if (current.trim()) batches.push(current.trim());

  return batches.length > 0 ? batches : [content];
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
// Process a single source file
// ---------------------------------------------------------------------------
type BamlClient = typeof import('../baml_client').b;

async function processFile(
  source: SourceFile,
  b: BamlClient,
): Promise<{ relSourceFile: string; flatChunks: FlatChunk[]; pageJson: unknown } | null> {
  const raw = readFileSync(source.filePath, 'utf-8');

  if (Buffer.byteLength(raw, 'utf-8') < MIN_FILE_BYTES) {
    console.log(
      `  SKIP (< ${MIN_FILE_BYTES} bytes): ${source.region}/${source.category}/${source.comuneSlug}`,
    );
    return null;
  }

  // The deep-research output is already clean — no pre-clean step.
  // Source URL is a local-file marker; ChunkPage only uses it as prompt
  // context and it's stored in the payload for traceability.
  const sourceUrl = `kb/${source.region}/${source.category}/.comuni/${source.comuneSlug}.md`;
  const relSourceFile = `${source.region}/${source.category}/.comuni/${source.comuneSlug}.md`;

  let pageTitle = source.comuneName;
  let pageSummary = '';
  const allChunks: Array<{ text: string; metadata: FlatChunk['links'] extends never ? never : any }> = [];

  if (raw.length > LARGE_FILE_CHARS) {
    const batches = splitByH2(raw);
    console.log(
      `  LARGE (${raw.length} chars) → ${batches.length} batches: ${source.region}/${source.category}/${source.comuneSlug}`,
    );
    for (let i = 0; i < batches.length; i++) {
      const result = await b.ChunkPage(source.comuneName, source.category, sourceUrl, batches[i]);
      if (i === 0) {
        pageTitle = result.page_title || source.comuneName;
        pageSummary = result.page_summary;
      }
      allChunks.push(...result.chunks);
    }
  } else {
    const result = await b.ChunkPage(source.comuneName, source.category, sourceUrl, raw);
    pageTitle = result.page_title || source.comuneName;
    pageSummary = result.page_summary;
    allChunks.push(...result.chunks);
  }

  if (allChunks.length === 0) {
    console.log(`  WARN no chunks produced: ${relSourceFile}`);
    return null;
  }

  const processedAt = new Date().toISOString();

  const flatChunks: FlatChunk[] = allChunks.map((chunk, idx) => ({
    chunk_id: `${source.region}/${source.category}/${source.comuneSlug}__${idx}`,
    text: chunk.text,
    page_title: pageTitle,
    page_summary: pageSummary,
    region: source.region,
    category: source.category,
    comune_name: source.comuneName,
    province: source.province,
    source_url: sourceUrl,
    source_file: relSourceFile,
    section_title: chunk.metadata.section_title,
    links: chunk.metadata.links ?? [],
    addresses: chunk.metadata.addresses ?? [],
    image_urls: chunk.metadata.image_urls ?? [],
    opening_hours: chunk.metadata.opening_hours ?? null,
    prices: chunk.metadata.prices ?? null,
    chunk_index: idx,
    total_chunks_in_page: allChunks.length,
  }));

  const pageJson = {
    source_file: relSourceFile,
    region: source.region,
    category: source.category,
    comune_name: source.comuneName,
    province: source.province,
    page_title: pageTitle,
    page_summary: pageSummary,
    source_url: sourceUrl,
    processed_at: processedAt,
    chunks: flatChunks.map((c) => ({
      chunk_id: c.chunk_id,
      text: c.text,
      metadata: {
        section_title: c.section_title,
        links: c.links,
        addresses: c.addresses,
        image_urls: c.image_urls,
        opening_hours: c.opening_hours,
        prices: c.prices,
      },
    })),
  };

  return { relSourceFile, flatChunks, pageJson };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const opts = parseArgs();

  const sources = discoverSources(opts);
  const progress = opts.force ? {} : loadProgress();

  const pending = sources.filter((s) => {
    const key = `${s.region}/${s.category}/.comuni/${s.comuneSlug}.md`;
    return !progress[key];
  });

  console.log(`\nKB source files: ${sources.length}`);
  console.log(`Already processed: ${sources.length - pending.length}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  if (opts.region) console.log(`Region filter: ${opts.region}`);
  if (opts.category) console.log(`Category filter: ${opts.category}`);
  if (opts.force) console.log(`Force mode: ignoring progress file`);
  if (opts.dryRun) console.log(`Dry run: no BAML calls, no file writes`);
  console.log();

  // Dry run: print the first 10 discovered files and exit. Useful to
  // verify region/category/comune derivation before burning LLM credits.
  if (opts.dryRun) {
    const sample = pending.slice(0, 10);
    console.log('Sample (first 10):');
    for (const s of sample) {
      console.log(
        `  ${s.region}/${s.category}/${s.comuneSlug} → comune="${s.comuneName}" province=${s.province ?? 'null'}`,
      );
    }
    if (pending.length > 10) console.log(`  ... and ${pending.length - 10} more`);
    return;
  }

  const { b } = await import('../baml_client');
  mkdirSync(CHUNKED_DIR, { recursive: true });

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (source) => {
        const idx = i + batch.indexOf(source) + 1;
        console.log(
          `[${idx}/${pending.length}] ${source.region}/${source.category}/${source.comuneSlug}`,
        );
        return processFile(source, b);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const source = batch[j];
      const label = `${source.region}/${source.category}/${source.comuneSlug}`;

      if (result.status === 'rejected') {
        console.error(`  FAIL: ${label} — ${result.reason}`);
        failed++;
        continue;
      }
      if (!result.value) {
        skipped++;
        continue;
      }

      const { relSourceFile, pageJson } = result.value;

      // Write per-page JSON mirroring the source directory structure.
      const outPath = join(
        CHUNKED_DIR,
        source.region,
        source.category,
        `${source.comuneSlug}.json`,
      );
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(pageJson, null, 2), 'utf-8');
      console.log(`  -> ${relSourceFile} (${result.value.flatChunks.length} chunks)`);

      progress[relSourceFile] = {
        processed_at: new Date().toISOString(),
        chunk_count: result.value.flatChunks.length,
      };
      saveProgress(progress);

      succeeded++;
    }

    if (i + CONCURRENCY < pending.length) {
      await sleep(DELAY_MS);
    }
  }

  // Rebuild all-chunks.json from every per-page JSON that exists on disk.
  // This way a partial run still produces a usable all-chunks.json for the
  // already-processed slice, and re-running after more KB data lands picks
  // up the delta plus everything that's already on disk.
  console.log('\nBuilding all-chunks.json from disk...');
  const allFlat: FlatChunk[] = [];

  function collectFromDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) {
        collectFromDir(p);
      } else if (p.endsWith('.json') && entry !== '.progress.json' && entry !== 'all-chunks.json') {
        try {
          const page = JSON.parse(readFileSync(p, 'utf-8'));
          if (!page.chunks || !page.region || !page.category) continue;
          for (let idx = 0; idx < page.chunks.length; idx++) {
            const c = page.chunks[idx];
            allFlat.push({
              chunk_id: c.chunk_id,
              text: c.text,
              page_title: page.page_title,
              page_summary: page.page_summary,
              region: page.region,
              category: page.category,
              comune_name: page.comune_name,
              province: page.province ?? null,
              source_url: page.source_url,
              source_file: page.source_file,
              section_title: c.metadata.section_title,
              links: c.metadata.links ?? [],
              addresses: c.metadata.addresses ?? [],
              image_urls: c.metadata.image_urls ?? [],
              opening_hours: c.metadata.opening_hours ?? null,
              prices: c.metadata.prices ?? null,
              chunk_index: idx,
              total_chunks_in_page: page.chunks.length,
            });
          }
        } catch (err) {
          console.warn(`  WARN could not parse ${p}: ${err}`);
        }
      }
    }
  }

  collectFromDir(CHUNKED_DIR);
  writeFileSync(ALL_CHUNKS_PATH, JSON.stringify(allFlat, null, 2), 'utf-8');

  console.log('\n========== Summary ==========');
  console.log(`Succeeded this run: ${succeeded}`);
  console.log(`Skipped this run:   ${skipped}`);
  console.log(`Failed this run:    ${failed}`);
  console.log(`Total chunks:       ${allFlat.length}`);
  console.log(`Output:             ${CHUNKED_DIR}`);
  console.log(`Combined:           ${ALL_CHUNKS_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
