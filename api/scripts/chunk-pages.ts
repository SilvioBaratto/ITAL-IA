/* eslint-disable @typescript-eslint/no-var-requires */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } = fs;
const { join, relative, basename, dirname } = path;

// Load .env from api/ directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..');
const SCRAPED_DIR = join(ROOT, 'kb', 'scraped');
const CHUNKED_DIR = join(ROOT, 'kb', 'chunked');
const PROGRESS_PATH = join(CHUNKED_DIR, '.progress.json');
const ALL_CHUNKS_PATH = join(CHUNKED_DIR, 'all-chunks.json');

const CONCURRENCY = 2;
const DELAY_MS = 2000;
const MIN_FILE_BYTES = 500;
const LARGE_FILE_CHARS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProgressEntry {
  processed_at: string;
  chunk_count: number;
}
type ProgressMap = Record<string, ProgressEntry>;

interface FlatChunk {
  chunk_id: string;
  text: string;
  page_title: string;
  page_summary: string;
  category: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function slugFromPath(filePath: string): string {
  return basename(filePath, '.md');
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

// ---------------------------------------------------------------------------
// Parse header from scraped markdown
// ---------------------------------------------------------------------------
function parseHeader(content: string): { title: string; category: string; sourceUrl: string } {
  const titleMatch = content.match(/^#\s+(.+)/m);
  const categoryMatch = content.match(/>\s*\*\*Category\*\*:\s*(.+)/);
  const sourceMatch = content.match(/>\s*\*\*Source\*\*:\s*\[([^\]]+)\]/);

  return {
    title: titleMatch?.[1]?.trim() ?? 'Untitled',
    category: categoryMatch?.[1]?.trim() ?? 'unknown',
    sourceUrl: sourceMatch?.[1]?.trim() ?? '',
  };
}

// ---------------------------------------------------------------------------
// Pre-clean markdown before sending to LLM
// ---------------------------------------------------------------------------
function preClean(content: string): string {
  let c = content;

  // Remove the header block we added (title, category, source, ---)
  c = c.replace(/^#\s+.+\n+>.*Category.*\n>.*Source.*\n+---\n*/m, '');

  // Strip everything before first real content heading (nav menus)
  // Find the first H1/H2 that looks like real content (not just the page title)
  const firstContentHeading = c.search(/^#{1,2}\s+[A-Z\u00C0-\u024F].{5,}/m);
  if (firstContentHeading > 200) {
    // There's a lot of cruft before the first heading
    c = c.slice(firstContentHeading);
  }

  // Remove mega-menu link lists: 5+ consecutive lines of `* [text](url)` to external domains
  c = c.replace(/(?:^\s*\*\s*\[!\[.*?\].*?\]\(.*?\).*$\n?){5,}/gm, '');
  c = c.replace(/(?:^\s*\*\s*\[.+?\]\(https?:\/\/(?!.*(?:friuli|trieste|udine|gorizia|pordenone|cividale|aquileia|collio|carso)).*?\)\s*$\n?){5,}/gm, '');

  // Strip footer blocks
  const footerPatterns = [
    /^#+\s*Related\s+Posts[\s\S]*$/im,
    /^#+\s*Leave\s+a\s+Reply[\s\S]*$/im,
    /^#+\s*Cookie\s+Policy[\s\S]*$/im,
    /All\s+Rights\s+Reserved[\s\S]*$/im,
    /^#+\s*(?:Footer|Sitemap)[\s\S]*$/im,
    /^#+\s*Newsletter[\s\S]*$/im,
  ];
  for (const pat of footerPatterns) {
    c = c.replace(pat, '');
  }

  // Remove form elements
  c = c.replace(/^(?:Name|Email|Website|Comment|Submit|Message)\s*\*?\s*$/gm, '');
  c = c.replace(/^\[Submit\].*$/gm, '');

  // Remove image-only lines that are logos/icons (small images in nav)
  c = c.replace(/^!\[Image \d+: (?:logo|icon|favicon|avatar).*\]\(.*\)\s*$/gim, '');

  // Remove login/signup/cart links
  c = c.replace(/^\[(?:Login|Sign Up|Register|Cart|Help|Sign In)\]\(.*\)\s*$/gim, '');

  // Remove currency/language selectors
  c = c.replace(/^(?:Language|Currency|Select Language|Select Currency):?\s*.*$/gim, '');
  c = c.replace(/^\s*\*\s*\[[$€£₺].+?\]\(.*?\)\s*$/gm, '');
  c = c.replace(/^\s*\*\s*\[(?:EN|TR|ES|FR|DE|IT|PT)\s*-\s*.+?\]\(.*?\)\s*$/gm, '');

  // Collapse 3+ blank lines to 2
  c = c.replace(/\n{3,}/g, '\n\n');

  return c.trim();
}

// ---------------------------------------------------------------------------
// Split large content by H2 sections
// ---------------------------------------------------------------------------
function splitByH2(content: string): string[] {
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
  if (current.trim()) {
    batches.push(current.trim());
  }

  return batches.length > 0 ? batches : [content];
}

// ---------------------------------------------------------------------------
// Discover all .md files
// ---------------------------------------------------------------------------
function discoverFiles(): string[] {
  const files: string[] = [];
  const categories = readdirSync(SCRAPED_DIR).filter((d: string) => {
    const p = join(SCRAPED_DIR, d);
    return statSync(p).isDirectory();
  });

  for (const cat of categories) {
    const catDir = join(SCRAPED_DIR, cat);
    const mds = readdirSync(catDir).filter((f: string) => f.endsWith('.md'));
    for (const md of mds) {
      files.push(join(catDir, md));
    }
  }

  return files.sort();
}

// ---------------------------------------------------------------------------
// Process a single file
// ---------------------------------------------------------------------------
async function processFile(
  filePath: string,
  b: { ChunkPage: (page_title: string, category: string, source_url: string, markdown_content: string) => Promise<any> },
): Promise<{ sourceFile: string; json: any; flatChunks: FlatChunk[] } | null> {
  const raw = readFileSync(filePath, 'utf-8');

  // Skip tiny files (CAPTCHA / empty)
  if (Buffer.byteLength(raw, 'utf-8') < MIN_FILE_BYTES) {
    console.log(`  SKIP (< ${MIN_FILE_BYTES} bytes): ${relative(SCRAPED_DIR, filePath)}`);
    return null;
  }

  const { title, category, sourceUrl } = parseHeader(raw);
  const cleaned = preClean(raw);

  if (cleaned.length < 100) {
    console.log(`  SKIP (cleaned < 100 chars): ${relative(SCRAPED_DIR, filePath)}`);
    return null;
  }

  const relPath = relative(SCRAPED_DIR, filePath);
  const categorySlug = dirname(relPath);
  const slug = slugFromPath(filePath);

  let allChunks: any[] = [];
  let pageTitle = '';
  let pageSummary = '';

  if (cleaned.length > LARGE_FILE_CHARS) {
    // Split large files
    const batches = splitByH2(cleaned);
    console.log(`  LARGE file (${cleaned.length} chars) -> ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      console.log(`    batch ${i + 1}/${batches.length} (${batches[i].length} chars)`);
      const result = await b.ChunkPage(title, category, sourceUrl, batches[i]);

      if (i === 0) {
        pageTitle = result.page_title;
        pageSummary = result.page_summary;
      }
      allChunks.push(...result.chunks);
    }
  } else {
    const result = await b.ChunkPage(title, category, sourceUrl, cleaned);
    pageTitle = result.page_title;
    pageSummary = result.page_summary;
    allChunks = result.chunks;
  }

  // Build per-page JSON
  const sourceFile = `${categorySlug}/${slug}.md`;
  const processedAt = new Date().toISOString();

  const chunksWithIds = allChunks.map((chunk: any, idx: number) => ({
    chunk_id: `${categorySlug}/${slug}__${idx}`,
    text: chunk.text,
    metadata: {
      section_title: chunk.metadata.section_title,
      links: chunk.metadata.links ?? [],
      addresses: chunk.metadata.addresses ?? [],
      image_urls: chunk.metadata.image_urls ?? [],
      opening_hours: chunk.metadata.opening_hours ?? null,
      prices: chunk.metadata.prices ?? null,
    },
  }));

  const pageJson = {
    source_file: sourceFile,
    page_title: pageTitle,
    page_summary: pageSummary,
    category: categorySlug,
    source_url: sourceUrl,
    processed_at: processedAt,
    chunks: chunksWithIds,
  };

  // Build flat chunks for all-chunks.json
  const flatChunks: FlatChunk[] = chunksWithIds.map((c: any, idx: number) => ({
    chunk_id: c.chunk_id,
    text: c.text,
    page_title: pageTitle,
    page_summary: pageSummary,
    category: categorySlug,
    source_url: sourceUrl,
    source_file: sourceFile,
    section_title: c.metadata.section_title,
    links: c.metadata.links,
    addresses: c.metadata.addresses,
    image_urls: c.metadata.image_urls,
    opening_hours: c.metadata.opening_hours,
    prices: c.metadata.prices,
    chunk_index: idx,
    total_chunks_in_page: chunksWithIds.length,
  }));

  return { sourceFile, json: pageJson, flatChunks };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Dynamic import of BAML client (CommonJS compat)
  const { b } = await import('../baml_client');

  const files = discoverFiles();
  const progress = loadProgress();

  mkdirSync(CHUNKED_DIR, { recursive: true });

  // Filter out already-processed files
  const pending = files.filter((f) => {
    const rel = relative(SCRAPED_DIR, f);
    const key = `${dirname(rel)}/${slugFromPath(f)}.md`;
    return !progress[key];
  });

  console.log(`\nTotal files: ${files.length}`);
  console.log(`Already processed: ${files.length - pending.length}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (filePath) => {
        const rel = relative(SCRAPED_DIR, filePath);
        console.log(`[${i + batch.indexOf(filePath) + 1}/${pending.length}] Processing: ${rel}`);
        return processFile(filePath, b);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const rel = relative(SCRAPED_DIR, batch[j]);

      if (result.status === 'rejected') {
        console.error(`  FAIL: ${rel} — ${result.reason}`);
        failed++;
        continue;
      }

      const value = result.value;
      if (!value) {
        skipped++;
        continue;
      }

      // Write per-page JSON
      const outDir = join(CHUNKED_DIR, dirname(value.sourceFile));
      mkdirSync(outDir, { recursive: true });
      const outPath = join(CHUNKED_DIR, value.sourceFile.replace('.md', '.json'));
      writeFileSync(outPath, JSON.stringify(value.json, null, 2), 'utf-8');
      console.log(`  -> ${relative(CHUNKED_DIR, outPath)} (${value.json.chunks.length} chunks)`);

      // Update progress
      const key = value.sourceFile;
      progress[key] = {
        processed_at: value.json.processed_at,
        chunk_count: value.json.chunks.length,
      };
      saveProgress(progress);

      succeeded++;
    }

    // Rate-limit between batches
    if (i + CONCURRENCY < pending.length) {
      await sleep(DELAY_MS);
    }
  }

  // Build combined all-chunks.json from all per-page JSONs
  console.log('\nBuilding all-chunks.json...');
  const allFlat: FlatChunk[] = [];

  const categories = readdirSync(CHUNKED_DIR).filter((d: string) => {
    const p = join(CHUNKED_DIR, d);
    return existsSync(p) && statSync(p).isDirectory();
  });

  for (const cat of categories) {
    const catDir = join(CHUNKED_DIR, cat);
    const jsonFiles = readdirSync(catDir).filter((f: string) => f.endsWith('.json'));

    for (const jf of jsonFiles) {
      const pageData = JSON.parse(readFileSync(join(catDir, jf), 'utf-8'));
      for (let idx = 0; idx < pageData.chunks.length; idx++) {
        const c = pageData.chunks[idx];
        allFlat.push({
          chunk_id: c.chunk_id,
          text: c.text,
          page_title: pageData.page_title,
          page_summary: pageData.page_summary,
          category: pageData.category,
          source_url: pageData.source_url,
          source_file: pageData.source_file,
          section_title: c.metadata.section_title,
          links: c.metadata.links,
          addresses: c.metadata.addresses,
          image_urls: c.metadata.image_urls,
          opening_hours: c.metadata.opening_hours,
          prices: c.metadata.prices,
          chunk_index: idx,
          total_chunks_in_page: pageData.chunks.length,
        });
      }
    }
  }

  writeFileSync(ALL_CHUNKS_PATH, JSON.stringify(allFlat, null, 2), 'utf-8');

  // Summary
  console.log('\n========== Summary ==========');
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total chunks: ${allFlat.length}`);
  console.log(`Output: ${CHUNKED_DIR}`);
  console.log(`Combined: ${ALL_CHUNKS_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
