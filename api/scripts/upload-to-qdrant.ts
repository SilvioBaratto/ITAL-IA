import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { QdrantClient } from '@qdrant/js-client-rest';

const { readFileSync } = fs;
const { join } = path;

// Load .env from api/ directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..');
const ALL_CHUNKS_PATH = join(ROOT, 'kb', 'chunked', 'all-chunks.json');

const EMBED_BATCH_SIZE = 16; // Azure embeddings: keep batches small to stay under per-request token limits
const UPSERT_BATCH_SIZE = 100;

// Azure OpenAI S0 tier for this project:
//   - 250,000 tokens/minute
//   - 1,500 requests/minute
// Each batch of 16 chunks ≈ 6-10K tokens, so TPM is the binding limit.
// At 2000ms between batches we do ~30 batches/min ≈ 180-300K TPM —
// the upper end of that can spike past 250K on big chunks, and
// MAX_EMBED_RETRIES covers those spikes with exponential backoff.
const EMBED_DELAY_MS = 2000;

// Retry-on-429 config. Azure's 429 sends a "Please retry after N
// seconds" header (Retry-After); we honor it when present, otherwise
// fall back to an exponential schedule: 1.5, 3, 6, 12, 24, 48 seconds.
const MAX_EMBED_RETRIES = 6;
const EMBED_RETRY_BASE_MS = 1500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
/**
 * Mirrors the FlatChunk interface in `chunk-kb.ts` and the ItaliaKBPayload
 * in `src/modules/qdrant/qdrant.service.ts`. When you add a field here,
 * add it in both other places and document it in `.claude/skills/qdrant/SKILL.md`.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Deterministic UUID v5 from chunk_id string */
function chunkIdToUuid(chunkId: string): string {
  // Use a fixed namespace UUID for deterministic generation
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // URL namespace UUID
  const hash = crypto.createHash('sha1');
  // Parse namespace UUID to bytes
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  hash.update(nsBytes);
  hash.update(chunkId);
  const digest = hash.digest();

  // Set version 5
  digest[6] = (digest[6] & 0x0f) | 0x50;
  // Set variant
  digest[8] = (digest[8] & 0x3f) | 0x80;

  const hex = digest.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Azure OpenAI Embeddings via fetch
// ---------------------------------------------------------------------------
function getAzureEmbedConfig(): { url: string; apiKey: string; model: string } {
  const endpoint = process.env.AZURE_OPENAI_EMBEDDINGS_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_EMBEDDINGS_API_VERSION;
  const apiKey = process.env.AZURE_OPENAI_EMBEDDINGS_API_KEY;
  const model = process.env.AZURE_OPENAI_EMBEDDINGS_MODEL ?? deployment ?? '';

  if (!endpoint) throw new Error('AZURE_OPENAI_EMBEDDINGS_ENDPOINT is not set');
  if (!deployment) throw new Error('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT is not set');
  if (!apiVersion) throw new Error('AZURE_OPENAI_EMBEDDINGS_API_VERSION is not set');
  if (!apiKey) throw new Error('AZURE_OPENAI_EMBEDDINGS_API_KEY is not set');

  const base = endpoint.replace(/\/+$/, '');
  const url = `${base}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
  return { url, apiKey, model };
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const { url, apiKey } = getAzureEmbedConfig();

  // Retry with exponential backoff on 429 (rate limit) and 5xx. Azure
  // OpenAI's S0 tier has a tight TPM ceiling that we can bump against
  // on long ingestion runs; a transient 429 should NOT kill the whole
  // upload — retrying with a growing delay lets the quota window reset.
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_EMBED_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({ input: texts }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
      };
      // Sort by index to maintain order
      return json.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }

    // Non-retryable — fail fast on 4xx that aren't 429
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Azure OpenAI embeddings failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const body = await res.text().catch(() => '');
    lastErr = new Error(
      `Azure OpenAI embeddings failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
    );

    // Respect the Retry-After header if Azure sends one; otherwise
    // fall back to an exponential schedule: 1.5s, 3s, 6s, 12s, 24s, 48s.
    const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10);
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : EMBED_RETRY_BASE_MS * Math.pow(2, attempt);

    console.log(
      `    [RETRY ${attempt + 1}/${MAX_EMBED_RETRIES}] HTTP ${res.status}, waiting ${waitMs}ms...`,
    );
    await sleep(waitMs);
  }

  throw lastErr ?? new Error('Azure OpenAI embeddings failed after all retries');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Validate env (Azure embeddings env vars validated lazily by getAzureEmbedConfig)
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  if (!qdrantUrl) throw new Error('QDRANT_URL is not set');
  if (!qdrantApiKey) throw new Error('QDRANT_API_KEY is not set');

  const collectionName = process.env.QDRANT_COLLECTION_NAME;
  if (!collectionName) throw new Error('QDRANT_COLLECTION_NAME is not set');

  const vectorSizeRaw = process.env.AZURE_OPENAI_EMBEDDINGS_DIM;
  if (!vectorSizeRaw) throw new Error('AZURE_OPENAI_EMBEDDINGS_DIM is not set');
  const vectorSize = parseInt(vectorSizeRaw, 10);
  if (Number.isNaN(vectorSize)) {
    throw new Error('AZURE_OPENAI_EMBEDDINGS_DIM must be an integer');
  }

  const { model: embeddingModel } = getAzureEmbedConfig();

  // Load chunks
  console.log(`Loading chunks from ${ALL_CHUNKS_PATH}...`);
  const chunks: FlatChunk[] = JSON.parse(readFileSync(ALL_CHUNKS_PATH, 'utf-8'));
  console.log(`Loaded ${chunks.length} chunks\n`);

  // Init Qdrant client
  const qdrant = new QdrantClient({
    url: qdrantUrl,
    apiKey: qdrantApiKey,
  });

  // Create collection (recreate if exists)
  console.log(`Creating collection "${collectionName}"...`);
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === collectionName);

  if (exists) {
    console.log(`  Collection exists, deleting first...`);
    await qdrant.deleteCollection(collectionName);
  }

  await qdrant.createCollection(collectionName, {
    vectors: { size: vectorSize, distance: 'Cosine' },
  });
  console.log(`  Collection created (${vectorSize}d, Cosine)\n`);

  // Embed and upsert in batches
  console.log(`Embedding with ${embeddingModel} (Azure OpenAI) and upserting to Qdrant...`);
  console.log(`  Embed batch size: ${EMBED_BATCH_SIZE}`);
  console.log(`  Upsert batch size: ${UPSERT_BATCH_SIZE}\n`);

  let totalEmbedded = 0;
  let totalUpserted = 0;

  // Process in embedding batches
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchNum = Math.floor(i / EMBED_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length / EMBED_BATCH_SIZE);

    console.log(`[${batchNum}/${totalBatches}] Embedding ${batch.length} chunks...`);

    // Get embeddings
    const texts = batch.map((c) => c.text);
    const embeddings = await embedTexts(texts);
    totalEmbedded += embeddings.length;

    // Build Qdrant points. Region, comune_name, and province come from the
    // FlatChunk itself — they're derived from the source path in chunk-kb.ts
    // rather than hardcoded here, so the pipeline generalizes across regions.
    const points = batch.map((chunk, idx) => ({
      id: chunkIdToUuid(chunk.chunk_id),
      vector: embeddings[idx],
      payload: {
        chunk_id: chunk.chunk_id,
        text: chunk.text,
        page_title: chunk.page_title,
        page_summary: chunk.page_summary,
        region: chunk.region,
        category: chunk.category,
        comune_name: chunk.comune_name,
        province: chunk.province,
        source_url: chunk.source_url,
        source_file: chunk.source_file,
        section_title: chunk.section_title,
        links: chunk.links,
        addresses: chunk.addresses,
        image_urls: chunk.image_urls,
        opening_hours: chunk.opening_hours,
        prices: chunk.prices,
        chunk_index: chunk.chunk_index,
        total_chunks_in_page: chunk.total_chunks_in_page,
      },
    }));

    // Upsert in sub-batches if needed
    for (let j = 0; j < points.length; j += UPSERT_BATCH_SIZE) {
      const upsertBatch = points.slice(j, j + UPSERT_BATCH_SIZE);
      await qdrant.upsert(collectionName, {
        wait: true,
        points: upsertBatch,
      });
      totalUpserted += upsertBatch.length;
    }

    console.log(`  Upserted ${totalUpserted}/${chunks.length} points`);

    // Rate-limit between embedding batches
    if (i + EMBED_BATCH_SIZE < chunks.length) {
      await sleep(EMBED_DELAY_MS);
    }
  }

  // Create payload indexes for filtered search
  console.log('\nCreating payload indexes...');

  const keywordIndexes = [
    'category',
    'region',
    'comune_name',
    'source_file',
    'section_title',
    'chunk_id',
  ];
  for (const field of keywordIndexes) {
    await qdrant.createPayloadIndex(collectionName, {
      field_name: field,
      field_schema: 'keyword',
      wait: true,
    });
    console.log(`  Index: ${field} (keyword)`);
  }

  // Text index on page_title for full-text filter
  await qdrant.createPayloadIndex(collectionName, {
    field_name: 'page_title',
    field_schema: 'text',
    wait: true,
  });
  console.log(`  Index: page_title (text)`);

  // Integer index on chunk_index
  await qdrant.createPayloadIndex(collectionName, {
    field_name: 'chunk_index',
    field_schema: 'integer',
    wait: true,
  });
  console.log(`  Index: chunk_index (integer)`);

  // Verify
  const info = await qdrant.getCollection(collectionName);

  console.log('\n========== Summary ==========');
  console.log(`Collection: ${collectionName}`);
  console.log(`Total embedded: ${totalEmbedded}`);
  console.log(`Total upserted: ${totalUpserted}`);
  console.log(`Points in collection: ${info.points_count}`);
  console.log(`Vector size: ${vectorSize}`);
  console.log(`Embedding model: ${embeddingModel} (Azure OpenAI)`);
  console.log(`Payload indexes: ${keywordIndexes.join(', ')}, page_title, chunk_index`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
