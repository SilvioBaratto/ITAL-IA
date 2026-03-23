import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, 'links.csv');
const OUTPUT_DIR = join(__dirname, 'scraped');
const JINA_PREFIX = 'https://r.jina.ai/';
const CONCURRENCY = 3;
const MAX_RETRIES = 2;
const DELAY_MS = 1500;

interface LinkEntry {
  category: string;
  name: string;
  url: string;
}

function parseCSV(path: string): LinkEntry[] {
  const raw = readFileSync(path, 'utf-8');
  const lines = raw.trim().split('\n').slice(1);
  return lines.map((line: string) => {
    // URL is always the last field (starts with http)
    const urlMatch = line.match(/(https?:\/\/.+)$/);
    if (!urlMatch) throw new Error(`No URL found in line: ${line}`);
    const url = urlMatch[1].trim();
    const rest = line.slice(0, line.indexOf(url)).replace(/,\s*$/, '');
    const firstComma = rest.indexOf(',');
    const category = rest.slice(0, firstComma).trim();
    const name = rest.slice(firstComma + 1).trim();
    return { category, name, url };
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMarkdown(url: string, attempt = 1): Promise<string> {
  const jinaUrl = `${JINA_PREFIX}${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
        'X-No-Cache': 'true',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    return await res.text();
  } catch (err: unknown) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);

    if (attempt <= MAX_RETRIES) {
      console.log(`    ↻ retry ${attempt}/${MAX_RETRIES}`);
      await sleep(DELAY_MS * attempt);
      return fetchMarkdown(url, attempt + 1);
    }
    throw new Error(`Failed after ${MAX_RETRIES} retries: ${msg}`);
  }
}

function cleanMarkdown(md: string): string {
  let cleaned = md;
  // Strip Jina metadata header (Title:, URL Published Time: etc.)
  cleaned = cleaned.replace(/^(Title|URL Published Time|Published Time|URL Source|Markdown Content)[^\n]*\n*/gm, '');
  // Remove YAML front matter
  cleaned = cleaned.replace(/^\s*---[\s\S]*?---\s*/m, '');
  // Collapse 4+ blank lines to 2
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  // Remove excessive trailing whitespace per line
  cleaned = cleaned.replace(/[ \t]+$/gm, '');
  return cleaned.trim();
}

async function scrapeEntry(entry: LinkEntry, index: number, total: number): Promise<boolean> {
  const catSlug = slugify(entry.category);
  const nameSlug = slugify(entry.name);
  const catDir = join(OUTPUT_DIR, catSlug);
  const outPath = join(catDir, `${nameSlug}.md`);

  if (existsSync(outPath)) {
    console.log(`  [${index}/${total}] skip: ${entry.name}`);
    return true;
  }

  mkdirSync(catDir, { recursive: true });

  try {
    console.log(`  [${index}/${total}] fetch: ${entry.name}`);
    const md = await fetchMarkdown(entry.url);
    const cleaned = cleanMarkdown(md);

    if (cleaned.length < 50) {
      console.error(`  [${index}/${total}] WARN: very short content (${cleaned.length} chars), saving anyway`);
    }

    const header = [
      `# ${entry.name}`,
      '',
      `> **Category**: ${entry.category}`,
      `> **Source**: [${entry.url}](${entry.url})`,
      '',
      '---',
      '',
    ].join('\n');

    writeFileSync(outPath, header + cleaned + '\n', 'utf-8');
    console.log(`  [${index}/${total}] ✓ saved (${cleaned.length} chars)`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [${index}/${total}] ✗ FAIL: ${entry.name} — ${msg}`);
    return false;
  }
}

async function main(): Promise<void> {
  const entries = parseCSV(CSV_PATH);
  const total = entries.length;
  console.log(`Scraping ${total} URLs (concurrency: ${CONCURRENCY})\n`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry, j) => scrapeEntry(entry, i + j + 1, total)),
    );

    for (const ok of results) {
      if (ok) succeeded++;
      else failed++;
    }

    // Rate-limit between batches
    if (i + CONCURRENCY < total) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  const categories = [...new Set(entries.map((e: LinkEntry) => e.category))];
  console.log('\n========== Summary ==========');
  console.log(`Total: ${total} | Succeeded: ${succeeded} | Failed: ${failed}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (const cat of categories) {
    const catDir = join(OUTPUT_DIR, slugify(cat));
    if (existsSync(catDir)) {
      const files = readdirSync(catDir).filter((f: string) => f.endsWith('.md'));
      console.log(`  ${cat}: ${files.length} files`);
    }
  }
}

main().catch(console.error);
