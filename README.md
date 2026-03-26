# ITAL-IA

**Live:** [italia.silviobaratto.com](https://italia.silviobaratto.com)

A chatbot that knows about Italian regions. You ask it about food, events, places to visit, or local culture, and it answers using a scraped knowledge base for that region. Responses stream in real time via SSE.

Currently covers Friuli Venezia Giulia. More regions to come.

## What it does

- Chat with a RAG assistant that pulls from a per-region knowledge base (web-scraped, chunked, stored in Qdrant)
- Supabase Auth handles login, JWT validation, token refresh
- Works on mobile and desktop (tested with Playwright on both viewports)

## Tech Stack

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| Backend        | NestJS 11, Prisma ORM, Zod validation  |
| Frontend       | Angular 21, Signals, Tailwind CSS 4    |
| Database       | Supabase (PostgreSQL)                  |
| Vector Search  | Qdrant (`italia-kb` collection)        |
| AI/LLM         | BAML (GPT-5 Mini), OpenAI embeddings   |
| Infrastructure | Docker, Vercel, GitHub Actions CI/CD   |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional, for containerized development)
- A [Supabase](https://supabase.com) project
- API keys: OpenAI, Anthropic, Qdrant

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/SilvioBaratto/italia.git
cd italia
```

2. **Configure environment variables**

```bash
cp api/.env.example api/.env
```

Fill in the required values:

| Variable                   | Description                       |
| -------------------------- | --------------------------------- |
| `DATABASE_URL`             | Supabase pooled connection string |
| `DIRECT_URL`               | Supabase direct connection string |
| `SUPABASE_URL`             | Supabase project URL              |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key          |
| `OPENAI_API_KEY`           | OpenAI API key (embeddings)       |
| `ANTHROPIC_API_KEY`        | Anthropic API key (chat)          |
| `QDRANT_URL`               | Qdrant instance URL               |
| `QDRANT_API_KEY`           | Qdrant API key                    |

3. **Run with Docker** (recommended)

```bash
docker compose up -d --build
```

Or **run each service locally**:

```bash
# Backend
cd api
npm install
npx prisma generate
npx baml-cli generate
npm run start:dev          # http://localhost:8000

# Frontend (in a separate terminal)
cd frontend
npm install
ng serve                   # http://localhost:4200
```

4. **Apply database migrations**

```bash
cd api
npx prisma migrate deploy
```

### Services

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:4200      |
| API                | http://localhost:8000      |
| API Docs (Swagger) | http://localhost:8000/docs |

## Architecture

```
italia/
├── api/                           # NestJS backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/              # Supabase JWT guard (global), /auth/me, account deletion
│   │   │   ├── chatbot/           # RAG pipeline + SSE streaming
│   │   │   ├── chat-conversation/ # Conversation CRUD (messages, titles)
│   │   │   ├── region/            # Region list endpoint (cached)
│   │   │   ├── poi/               # Points of interest lookup
│   │   │   ├── saved-items/       # Bookmarks with async POI linking
│   │   │   ├── qdrant/            # Vector similarity search wrapper
│   │   │   ├── health/            # Health check
│   │   │   └── test/              # In-memory CRUD for testing
│   │   ├── prisma/                # Global PrismaService (PrismaPg adapter for Supabase)
│   │   └── common/                # @Public(), @CurrentUser(), exception filters, logging
│   ├── prisma/schema.prisma       # Region, PointOfInterest, SavedItem + chat models
│   ├── baml_src/                  # StreamRAGChat prompt + LLM client definitions
│   ├── scripts/                   # KB ingestion: chunk-pages.ts, upload-to-qdrant.ts
│   └── serverless.ts              # Vercel entry point (singleton Express across cold starts)
├── frontend/                      # Angular SPA
│   ├── src/app/
│   │   ├── pages/
│   │   │   ├── chatbot/           # Main chat page (streaming, bookmarks, follow-up suggestions)
│   │   │   ├── saved/             # Saved items with category filters, detail pane/bottom sheet
│   │   │   ├── profile/           # User info, account deletion
│   │   │   └── not-found/         # 404
│   │   ├── services/              # auth, chat (SSE), chat-history, conversation, region,
│   │   │                          # explore, saved-items, theme, toast, mobile-chat-bridge
│   │   ├── guards/                # authGuard, guestGuard
│   │   ├── interceptors/          # Bearer token injection, 401 refresh + retry
│   │   ├── models/                # TypeScript interfaces (chat, conversation, region, saved-item)
│   │   └── shared/                # layout, sidebar, bottom-tab-bar, chat-input, region-selector,
│   │                              # region-bottom-sheet, inline-edit, toast, markdown pipe
│   ├── e2e/                       # Playwright tests (desktop + mobile)
│   └── assets/explore/            # Per-region quick-prompt JSON files
├── kb/                            # Offline KB pipeline (not committed)
│   ├── links.csv                  # Source URLs by category
│   ├── scrape.ts                  # Web scraper (Jina API)
│   ├── scraped/                   # Raw markdown per category
│   └── chunked/                   # BAML-processed JSON chunks
└── docker-compose.yml             # api:8000 + frontend:4200 (nginx proxy)
```

### How the chat works

All routes sit behind `/api/v1` and require a Supabase JWT unless marked `@Public()`.

Request flow: Helmet -> CORS -> ThrottlerGuard (100 req/60s) -> SupabaseAuthGuard -> ZodValidationPipe -> route handler -> exception filters

Chat flow: user query -> OpenAI embedding -> Qdrant cosine search (`italia-kb`, top 5, score >= 0.75) -> BAML `StreamRAGChat()` (GPT-5 Mini, parameterized by region) -> SSE stream to client

The frontend reads the SSE stream with a raw `fetch` + `ReadableStream` (not HttpClient). On 401 it refreshes the token and retries once.

### Knowledge base ingestion

Offline, two-step pipeline:

```
kb/links.csv -> scrape.ts -> kb/scraped/{category}/*.md
  -> scripts/chunk-pages.ts -> kb/chunked/all-chunks.json
  -> scripts/upload-to-qdrant.ts -> OpenAI embedding (ada-002, batches of 50)
  -> Qdrant upsert (italia-kb, 1536-dim cosine, region-filterable)
```

### Database

Three main models in Prisma: `Region` (20 Italian regions with `hasKb` flag), `PointOfInterest` (canonical places linked to a region), and `SavedItem` (user bookmarks with best-effort POI linking). Chat conversations and messages are stored separately for history persistence.

## Development

### Backend

```bash
cd api
npm run start:dev              # Dev server with hot reload
npm test                       # Run Jest tests
npm run test:cov               # Coverage report
npx prisma migrate dev         # Create + apply migration
npx prisma studio              # Visual database editor
npx baml-cli generate          # Regenerate BAML client
```

### Frontend

```bash
cd frontend
ng serve                       # Dev server on :4200
npx playwright test            # E2E tests (desktop + mobile)
ng build --configuration=production
```

### Knowledge Base

```bash
# 1. Update kb/links.csv with source URLs
# 2. Scrape content
npx tsx kb/scrape.ts

# 3. Chunk via BAML
cd api && npx ts-node -r tsconfig-paths/register scripts/chunk-pages.ts

# 4. Upload to Qdrant
npx ts-node -r tsconfig-paths/register scripts/upload-to-qdrant.ts
```

## Deployment

Deploys to Vercel via GitHub Actions. Pushing to `main` deploys both the API and frontend automatically.

## License

MIT
