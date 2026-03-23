# Qdrant TypeScript Skill

Load this skill proactively whenever the user works with Qdrant, vector search, embeddings storage, or semantic search in this project. Do not wait to be asked; apply automatically.

## Project Setup

- Package: `@qdrant/js-client-rest` (already installed in `api/`)
- Env vars in `api/.env`: `QDRANT_URL`, `QDRANT_API_KEY`
- Cloud cluster: `https://38371948-2e32-422a-8080-71d0c6e3d712.eu-central-1-0.aws.cloud.qdrant.io:6333`

## Client Initialization

Always read credentials from environment variables, never hardcode them.

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
```

For NestJS, wrap the client in a module/service using `@Global()` and `ConfigService`.

## Core Operations Reference

### Collections

```typescript
// List collections
const { collections } = await client.getCollections();

// Create collection (single vector)
await client.createCollection('my_collection', {
  vectors: { size: 1536, distance: 'Cosine' },
});

// Create collection (named vectors)
await client.createCollection('multi_collection', {
  vectors: {
    image: { size: 512, distance: 'Cosine' },
    text: { size: 1536, distance: 'Dot' },
  },
});

// Get collection info
const info = await client.getCollection('my_collection');

// Delete collection
await client.deleteCollection('my_collection');
```

**Distance metrics**: `'Cosine'`, `'Euclid'`, `'Dot'`, `'Manhattan'`

### Upsert Points

```typescript
await client.upsert('my_collection', {
  wait: true,
  points: [
    {
      id: 1, // integer or UUID string
      vector: [0.05, 0.61, 0.76, 0.74],
      payload: { city: 'Berlin', country: 'Germany', population: 3645000 },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      vector: [0.24, 0.18, 0.22, 0.44],
      payload: { city: 'Trieste', region: 'Friuli Venezia Giulia' },
    },
  ],
});

// Named vectors
await client.upsert('multi_collection', {
  wait: true,
  points: [
    {
      id: 1,
      vector: { image: [0.1, 0.2], text: [0.3, 0.4] },
      payload: { title: 'Product 1' },
    },
  ],
});
```

### Search (Vector Similarity)

```typescript
// Basic search
const results = await client.search('my_collection', {
  vector: [0.2, 0.1, 0.9, 0.7],
  limit: 5,
});

// With filters and payload
const filtered = await client.search('my_collection', {
  vector: [0.2, 0.1, 0.9, 0.7],
  limit: 10,
  with_payload: true,
  with_vector: false,
  score_threshold: 0.8,
  filter: {
    must: [
      { key: 'country', match: { value: 'Germany' } },
      { key: 'population', range: { gte: 1000000 } },
    ],
    must_not: [
      { key: 'archived', match: { value: true } },
    ],
    should: [
      { key: 'category', match: { value: 'premium' } },
    ],
  },
  params: { hnsw_ef: 128, exact: false },
});
```

### Retrieve Points by ID

```typescript
const points = await client.retrieve('my_collection', {
  ids: [1, 2, 3],
  with_payload: true,
  with_vector: false,
});

// Specific payload fields only
const partial = await client.retrieve('my_collection', {
  ids: [1],
  with_payload: ['city', 'country'],
  with_vector: true,
});
```

### Recommend (Content-Based)

```typescript
const recs = await client.recommend('my_collection', {
  positive: [1, 5, 10],       // point IDs as positive examples
  negative: [7, 8],            // point IDs to avoid
  limit: 5,
  with_payload: true,
  strategy: 'average_vector',  // or 'best_score'
  filter: {
    must: [{ key: 'category', match: { value: 'travel' } }],
  },
});
```

### Payload Indexes

Create indexes to speed up filtered searches:

```typescript
// Keyword (exact match)
await client.createPayloadIndex('my_collection', {
  field_name: 'city',
  field_schema: 'keyword',
  wait: true,
});

// Integer, float, geo, text
await client.createPayloadIndex('my_collection', {
  field_name: 'population',
  field_schema: 'integer',
  wait: true,
});

await client.createPayloadIndex('my_collection', {
  field_name: 'coordinates',
  field_schema: 'geo',
  wait: true,
});

await client.createPayloadIndex('my_collection', {
  field_name: 'description',
  field_schema: 'text',
  wait: true,
});
```

## Filter Syntax Quick Reference

| Clause | Meaning |
|--------|---------|
| `must` | All conditions must match (AND) |
| `must_not` | None of the conditions must match (NOT) |
| `should` | At least one condition must match (OR) |

**Match types**:
- `{ key, match: { value } }` — exact match
- `{ key, range: { gte, lte, gt, lt } }` — numeric range
- `{ key, geo_bounding_box: { top_left, bottom_right } }` — geo box
- `{ key, geo_radius: { center, radius } }` — geo radius

## Common Vector Sizes

| Embedding Model | Dimensions |
|----------------|-----------|
| OpenAI `text-embedding-3-small` | 1536 |
| OpenAI `text-embedding-3-large` | 3072 |
| Azure OpenAI embeddings | 1536 |
| Cohere `embed-english-v3` | 1024 |
| Sentence Transformers (MiniLM) | 384 |

## NestJS Integration Pattern

When integrating into this project's NestJS backend:

1. Create a `QdrantModule` and `QdrantService` in `src/modules/qdrant/`
2. Use `ConfigService` to read `QDRANT_URL` and `QDRANT_API_KEY`
3. Make the module `@Global()` if multiple modules need vector search
4. Expose typed methods for collection-specific operations
5. Follow the existing pattern in `src/prisma/` for global service modules

```typescript
// Example service skeleton
@Injectable()
export class QdrantService {
  private readonly client: QdrantClient;

  constructor(private readonly config: ConfigService) {
    this.client = new QdrantClient({
      url: this.config.getOrThrow('QDRANT_URL'),
      apiKey: this.config.getOrThrow('QDRANT_API_KEY'),
    });
  }
}
```

## Rules

- Always use `wait: true` for upserts unless you explicitly need async indexing
- Always create payload indexes on fields you filter by frequently
- Use `score_threshold` to avoid low-quality matches
- Prefer `Cosine` distance for normalized embeddings (most common)
- Use UUID strings for point IDs when data comes from external systems
- Never store embeddings in PostgreSQL — use Qdrant for all vector operations
- Keep payloads lean; store full documents in PostgreSQL and reference by ID
