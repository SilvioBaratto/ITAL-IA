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
npx prisma migrate dev               # Create + apply migration
npx prisma migrate deploy            # Apply migrations (production)
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

## Conventions

- Angular: standalone components (don't set `standalone: true`, it's the default), `inject()` not constructor injection, `input()`/`output()` not decorators, native control flow (`@if`, `@for`, `@switch`), `ChangeDetectionStrategy.OnPush` on every component
- DTOs: `Create<Entity>Dto`, `Update<Entity>Dto`, `<Entity>ResponseDto` pattern, Zod-based via nestjs-zod
- API routes: all under `/api/v1`, protected by default, opt-out with `@Public()`
- Frontend npm: use `--legacy-peer-deps` flag

## KB ingestion (offline)

```bash
npx tsx kb/scrape.ts                                                    # Scrape sources
cd api && npx ts-node -r tsconfig-paths/register scripts/chunk-pages.ts # Chunk markdown
npx ts-node -r tsconfig-paths/register scripts/upload-to-qdrant.ts      # Embed + upload
```

Pipeline: `kb/links.csv` -> scrape -> `kb/scraped/` -> chunk -> `kb/chunked/all-chunks.json` -> OpenAI ada-002 embeddings (batches of 50) -> Qdrant upsert (`italia-kb`, 1536-dim cosine). Each vector has a `region` field for multi-region filtering.

## Deployment

Vercel via GitHub Actions. Pushing to `main` deploys both API and frontend. The API uses `serverless.ts` as entry point (singleton Express app cached across invocations).
