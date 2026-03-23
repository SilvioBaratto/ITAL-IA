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

const COLLECTION_NAME = 'italia-kb';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const VECTOR_SIZE = 1536;
const EMBED_BATCH_SIZE = 50; // OpenAI allows up to 2048 inputs per request
const UPSERT_BATCH_SIZE = 100;
const EMBED_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
// OpenAI Embeddings via fetch
// ---------------------------------------------------------------------------
async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings failed (HTTP ${res.status}): ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };

  // Sort by index to maintain order
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Validate env
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  if (!qdrantUrl) throw new Error('QDRANT_URL is not set');
  if (!qdrantApiKey) throw new Error('QDRANT_API_KEY is not set');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

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
  console.log(`Creating collection "${COLLECTION_NAME}"...`);
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === COLLECTION_NAME);

  if (exists) {
    console.log(`  Collection exists, deleting first...`);
    await qdrant.deleteCollection(COLLECTION_NAME);
  }

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
  });
  console.log(`  Collection created (${VECTOR_SIZE}d, Cosine)\n`);

  // Embed and upsert in batches
  console.log(`Embedding with ${EMBEDDING_MODEL} and upserting to Qdrant...`);
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

    // Build Qdrant points
    const points = batch.map((chunk, idx) => ({
      id: chunkIdToUuid(chunk.chunk_id),
      vector: embeddings[idx],
      payload: {
        chunk_id: chunk.chunk_id,
        text: chunk.text,
        page_title: chunk.page_title,
        page_summary: chunk.page_summary,
        category: chunk.category,
        region: 'friuli-venezia-giulia',
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
      await qdrant.upsert(COLLECTION_NAME, {
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

  const keywordIndexes = ['category', 'region', 'source_file', 'section_title', 'chunk_id'];
  for (const field of keywordIndexes) {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: field,
      field_schema: 'keyword',
      wait: true,
    });
    console.log(`  Index: ${field} (keyword)`);
  }

  // Text index on page_title for full-text filter
  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: 'page_title',
    field_schema: 'text',
    wait: true,
  });
  console.log(`  Index: page_title (text)`);

  // Integer index on chunk_index
  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: 'chunk_index',
    field_schema: 'integer',
    wait: true,
  });
  console.log(`  Index: chunk_index (integer)`);

  // Verify
  const info = await qdrant.getCollection(COLLECTION_NAME);

  console.log('\n========== Summary ==========');
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Total embedded: ${totalEmbedded}`);
  console.log(`Total upserted: ${totalUpserted}`);
  console.log(`Points in collection: ${info.points_count}`);
  console.log(`Vector size: ${VECTOR_SIZE}`);
  console.log(`Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`Payload indexes: ${keywordIndexes.join(', ')}, page_title, chunk_index`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
