# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Full-stack Italy regional discovery chatbot. NestJS 11 backend, Angular 21 frontend, Supabase (PostgreSQL + Auth), Qdrant vector DB, BAML for LLM integration. Currently covers Friuli Venezia Giulia. No local database — everything hits hosted Supabase.

Live at [italia.silviobaratto.com](https://italia.silviobaratto.com).

## Build and run

```bash
# Full stack via Docker
docker compose up -d --build

# Or run separately:
cd api && npm run start:dev          # Backend on :3005
cd frontend && ng serve              # Frontend on :4200
```

### API commands

```bash
cd api
npm test                             # Jest unit tests
npm run test:watch                   # Watch mode
npm run test:cov                     # Coverage
npm run build                        # Production build (nest build)
npx prisma generate                  # Regenerate Prisma client
npx prisma studio                    # Visual DB editor
npx baml-cli generate                # Regenerate BAML client after editing baml_src/
```

### Frontend commands

```bash
cd frontend
ng serve                             # Dev server on :4200
ng build --configuration=production
npx playwright test                  # E2E tests (desktop + mobile)
```

## Backend architecture (`api/`)

NestJS modular app. Entry points: `main.ts` (local dev, port 3005) and `serverless.ts` (Vercel, singleton Express cached across cold starts).

### Request pipeline

Helmet -> CORS -> `/api/v1` prefix -> LoggingMiddleware -> ThrottlerGuard (100 req/60s) -> SupabaseAuthGuard (global, bypass with `@Public()`) -> ZodValidationPipe -> route handler -> ZodSerializerInterceptor -> HttpExceptionFilter + PrismaClientExceptionFilter

### Modules

- **auth** — validates Supabase JWT via `supabase.auth.getUser()`, injects `req.user`. `@CurrentUser()` param decorator. Account deletion cascades through Supabase then DB.
- **chatbot** — the RAG pipeline. Embeds query (OpenAI) -> Qdrant cosine search (top 5, score >= 0.75, `italia-kb` collection) -> fetches user's trip context -> BAML `StreamRAGChat()` (GPT-5 Mini) -> SSE stream. The BAML response is a `RichChatResponse` with text, images, links, map_links, tables, sources, and item_categories.
- **chat-conversation** — CRUD for conversation persistence (create, list, get, append message, update title, delete).
- **region** — returns all 20 regions with `hasKb` flag. Cache-Control: 1hr with stale-while-revalidate.
- **poi** — points of interest lookup, filterable by region and category (13 categories). Cache-Control: 5min.
- **saved-items** — user bookmarks. Upsert with async best-effort POI linking (case-insensitive name match against PointOfInterest table, non-blocking).
- **qdrant** — wraps `@qdrant/js-client-rest`. `embed()` calls OpenAI text-embedding-ada-002. `search()` does cosine similarity with optional region filter.
- **health** — `@Public()`, checks DB with `SELECT 1`.
- **test** — in-memory CRUD for testing.

### Database (Prisma)

Models: `Region`, `PointOfInterest`, `SavedItem`, plus `ChatConversation` and `ChatMessage` for history. PrismaService uses the PrismaPg adapter for Supabase connection pooling. Zod schemas auto-generated from Prisma via `prisma-zod-generator` for DTO validation.

Path aliases in `tsconfig.json`: `@/*` -> `src/*`, `@generated/prisma`, `@generated/zod`.

### BAML

`baml_src/chatbot.baml` defines `StreamRAGChat` — the only LLM function used at runtime. `baml_src/clients.baml` defines LLM clients (GPT-5 Mini is the default for chat). Never edit `baml_client/` — it's auto-generated.

## Frontend architecture (`frontend/`)

Angular 21 with standalone components, signals, OnPush change detection, zoneless (`provideZonelessChangeDetection`).

### State management

All state lives in signals. No external state library. Services hold shared state (`signal()`), components derive from it (`computed()`). The `SavedItemsService` uses a `Map<string, SavedItem>` with optimistic updates and rollback on error.

### Chat streaming

`ChatService.streamMessage()` uses raw `fetch` + `ReadableStream` to consume SSE from `/api/v1/chat/stream` (not HttpClient, because HttpClient doesn't support SSE streaming). Returns `Observable<StreamChunk>`. On 401, refreshes token and retries once.

### Key services

- **auth** — Supabase client wrapper. Signals: `isAuthenticated`, `isInitialized`, `currentUser`. Google OAuth login.
- **chat-history** — orchestrates conversation persistence. Uses database as primary source of truth (not localStorage).
- **region** — holds 20 hardcoded regions as initial state, refreshes `hasKb` from API. Persists selected region to localStorage.
- **explore** — loads per-region quick-prompt JSON from `assets/explore/`. Falls back to `_default.json`.
- **saved-items** — signal-based store backed by API. Optimistic updates with rollback.
- **theme** — light/dark/system. Persisted to localStorage, applies `.dark` class to `<html>`.
- **mobile-chat-bridge** — decouples bottom tab bar from chatbot component. Suppresses nav auto-hide during programmatic scroll.

### Routing

Auth-protected shell (`LayoutComponent`) wraps `/` (chatbot), `/saved`, `/profile`. Guest routes: `/login`, `/auth/forgot-password`, `/auth/update-password`. Catch-all 404.

### Styling

Tailwind CSS v4, mobile-first. The `markdown.pipe.ts` transforms markdown to SafeHtml using `marked`, injecting `[N]` citation patterns as clickable `<sup>` links.

### E2E tests

Playwright in `e2e/`. Tests desktop (1280x720) and mobile (Pixel 5). Run with `npx playwright test`.

## Environment variables (`api/.env`)

Required: `DATABASE_URL`, `DIRECT_URL` (Supabase pooled/session), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`.

Optional: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`.

**`DATABASE_URL` vs `DIRECT_URL`** — runtime code uses `DATABASE_URL` (transaction pooler, port 6543) for efficient connection pooling across serverless cold starts. Prisma CLI commands (`migrate`, `db execute`) must use `DIRECT_URL` (session pooler, port 5432) because the transaction pooler hangs Prisma migrations indefinitely. See the "Database migrations" section below for the override pattern.

## Database migrations

**Do NOT use `npx prisma migrate dev`** on this project. It hangs because Supabase's pooler doesn't allow Prisma to create the shadow database it wants for diffing. The standard `migrate deploy` also targets `DATABASE_URL` (the 6543 pooler) which hangs Prisma migrations. The working pattern is to hand-write the migration SQL and apply it with `prisma db execute` against `DIRECT_URL`.

### Creating a new migration

1. **Edit `api/prisma/schema.prisma`** — add/remove/rename the fields you need.

2. **Create the migration folder and SQL file** by hand:
   ```
   api/prisma/migrations/{YYYYMMDDHHMMSS}_{short_name}/migration.sql
   ```
   Use a timestamp prefix newer than the most recent existing migration so Prisma applies it last. Write plain SQL — `ALTER TABLE`, `CREATE INDEX`, `ALTER TYPE ... ADD VALUE`, etc. Include a comment at the top explaining *why* the change is being made.

3. **Apply it to Supabase** using `DIRECT_URL` (the 5432 session pooler, NOT 6543):
   ```bash
   cd api
   DIRECT=$(grep '^DIRECT_URL=' .env | cut -d'=' -f2- | sed 's/^"//;s/"$//')
   DATABASE_URL="$DIRECT" npx prisma db execute \
     --file prisma/migrations/{folder}/migration.sql
   ```
   The `DATABASE_URL="$DIRECT"` override is load-bearing — without it, Prisma picks up the 6543 URL from `.env` via `prisma.config.ts` and hangs.

4. **Mark the migration as applied** in the `_prisma_migrations` bookkeeping table so future `prisma migrate status` runs reflect reality:
   ```bash
   DATABASE_URL="$DIRECT" npx prisma migrate resolve \
     --applied {migration_folder_name}
   ```

5. **Regenerate the Prisma client** (this one doesn't need the URL override — it doesn't talk to the DB):
   ```bash
   npx prisma generate
   ```

6. **Type-check** to catch any code that still references removed/renamed fields:
   ```bash
   npx tsc --noEmit
   ```

### Anatomy of the `api/prisma/migrations/` folder

- `migration_lock.toml` — tells Prisma this is a Postgres project. Required for any `prisma migrate diff --from-migrations` to work. Do not delete.
- `{timestamp}_{name}/migration.sql` — one folder per migration. Naming: `YYYYMMDDHHMMSS_snake_case_description`. Example: `20260409110000_remove_poi_neighborhood_latlng`.
- `_prisma_migrations` (in the database, not the folder) — Prisma's bookkeeping table listing which migrations have been applied. Updated by `migrate resolve`.

### Example: dropping columns

```sql
-- api/prisma/migrations/20260409110000_remove_poi_neighborhood_latlng/migration.sql
-- Rationale: the deep-research KB doesn't provide per-venue coordinates and
-- rarely names a quartiere. Dropping the nullable placeholders.

ALTER TABLE "points_of_interest" DROP COLUMN "neighborhood";
ALTER TABLE "points_of_interest" DROP COLUMN "latitude";
ALTER TABLE "points_of_interest" DROP COLUMN "longitude";
```

### When `prisma migrate dev` would be fine

On a local (non-Supabase) Postgres where the user has CREATE DATABASE privileges, `prisma migrate dev` works normally — it creates a shadow DB, diffs, and applies. This project doesn't have that option because all environments (dev/prod) hit hosted Supabase through the pooler. If someone ever sets up a local Postgres for offline work, they could use `migrate dev` against that one, then hand-port the generated SQL into the `api/prisma/migrations/` folder for Supabase.

## Conventions

- Angular: standalone components (don't set `standalone: true`, it's the default), `inject()` not constructor injection, `input()`/`output()` not decorators, native control flow (`@if`, `@for`, `@switch`), `ChangeDetectionStrategy.OnPush` on every component
- DTOs: `Create<Entity>Dto`, `Update<Entity>Dto`, `<Entity>ResponseDto` pattern, Zod-based via nestjs-zod
- API routes: all under `/api/v1`, protected by default, opt-out with `@Public()`
- Frontend npm: use `--legacy-peer-deps` flag

## KB ingestion (offline)

```bash
cd api
# 1. Chunk the deep-research KB via BAML (all regions + categories)
npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts
# or scope to one region/category:
npx ts-node -r tsconfig-paths/register scripts/chunk-kb.ts --region friuli-venezia-giulia --category RESTAURANT

# 2. Embed + upload to Qdrant (wipes and recreates the collection)
npx ts-node -r tsconfig-paths/register scripts/upload-to-qdrant.ts
```

Pipeline: `kb/{region-slug}/{CATEGORY}/.comuni/{comune-slug}.md` (produced by `kb/run-deep-research.py`) → BAML `ChunkPage` → `kb/chunked/{region}/{category}/{comune}.json` → aggregated into `kb/chunked/all-chunks.json` → Azure OpenAI embeddings (batches of 16) → Qdrant upsert (`italia-kb`, cosine, vector size from `AZURE_OPENAI_EMBEDDINGS_DIM`). Every vector carries `region`, `category`, `comune_name`, `province` in its payload for multi-field filtering at retrieval time.

## Deployment

Vercel via GitHub Actions. Pushing to `main` deploys both API and frontend. The API uses `serverless.ts` as entry point (singleton Express app cached across invocations).
