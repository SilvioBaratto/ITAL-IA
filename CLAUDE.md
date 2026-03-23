# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack Italy regional discovery app (ITAL-IA): **NestJS 11** backend, **Angular 21** frontend, **Supabase** (PostgreSQL + Auth), **Qdrant** vector DB, and **BAML** for LLM integration. Covers all Italian regions — first region with KB content is Friuli Venezia Giulia. No local database — uses hosted Supabase.

## Build & Run Commands

```bash
# Full stack with Docker
docker compose up -d --build

# Individual services
cd api && npm run start:dev                       # Backend on :8000
cd frontend && ng serve                           # Frontend on :4200

# API development
cd api
npm install
npm test                                          # Jest unit tests
npm run test:watch                                # Watch mode
npm run test:cov                                  # Coverage report
npx prisma migrate dev                            # Create and apply migration
npx prisma migrate deploy                         # Apply migrations (production)
npx prisma generate                               # Regenerate Prisma client after schema changes
npx baml-cli generate                             # Regenerate BAML client after .baml changes

# Frontend development
cd frontend
npm install
ng serve                                          # Dev server on :4200
ng build --configuration=production               # Production build
npx playwright test                               # E2E tests (desktop + mobile)
```

## Architecture

### Backend (`api/`)

NestJS modular architecture with global middleware stack configured in `main.ts`:

| Layer | Purpose |
|-------|---------|
| `src/modules/` | Feature modules: auth, chatbot, itinerary, qdrant, health, test |
| `src/prisma/` | `@Global()` PrismaModule — shared across all modules |
| `src/common/` | `@Public()` decorator, exception filters, logging middleware, transform interceptor |
| `prisma/schema.prisma` | Database models (Trip → TripDay → Activity → Place) |
| `baml_src/` | LLM function definitions for RAG chat and PDF extraction |

**Global middleware** (applied in `main.ts`): Helmet security headers → CORS → `/api/v1` prefix → ZodValidationPipe → HttpExceptionFilter + PrismaClientExceptionFilter → TransformInterceptor → ThrottlerGuard (100 req/60s).

**Authentication**: Supabase JWT. `SupabaseAuthGuard` is global — all routes require auth unless marked with `@Public()`. The guard validates tokens via Supabase API and injects `userId` into the request.

**Key modules**:
- **chatbot**: RAG pipeline — embeds query (OpenAI) → searches Qdrant (`italia-kb`) → fetches user's latest trip for context → calls BAML `StreamRAGChat()` (Claude Haiku 4.5, parameterized by region) → streams SSE response
- **itinerary**: Full CRUD for trips/days/activities (dormant — hidden from nav, code intact for future use). `uploadPdfAndExtract()` parses PDFs via BAML. Nested routes: `/itineraries/:id/days/:dayId/activities`
- **qdrant**: Wraps `@qdrant/js-client-rest` for vector similarity search

**Database models** (Prisma): Trip → TripDay → Activity → Place, plus ActivityHighlight, Booking, TravelTip. All user-scoped via `userId`. Cascading deletes enabled. Zod schemas auto-generated from Prisma for DTO validation.

**Path aliases** in `tsconfig.json`: `@/*` → `src/*`, `@generated/prisma`, `@generated/zod`.

### Frontend (`frontend/`)

Angular 21 with standalone components, signals, and OnPush change detection throughout.

| Layer | Purpose |
|-------|---------|
| `src/app/pages/` | Page components: chatbot (primary), itinerary (dormant) |
| `src/app/services/` | AuthService, ChatService, ItineraryService |
| `src/app/guards/` | `authGuard` (protect routes), `guestGuard` (redirect if logged in) |
| `src/app/interceptors/` | `authInterceptor` — injects Bearer token, handles 401 refresh |
| `src/app/shared/` | Layout, sidebar, inline-edit component, markdown pipe |
| `src/app/models/` | TypeScript interfaces for chat and itinerary data |
| `src/environments/` | Environment configs (apiUrl, supabase credentials) |

**State management**: Signals (`signal()`, `computed()`) — no external state library. Services hold shared state; components use local signals.

**Styling**: Tailwind CSS 4.1, mobile-first responsive design.

**Chat streaming**: `ChatService.streamMessage()` uses raw `EventSource` (not HttpClient) to consume SSE from `/api/v1/chat/stream`. Returns `Observable<StreamChunk>`.

**E2E tests**: Playwright (`e2e/italia.spec.ts`) covering login, chatbot, and mobile responsiveness. Config tests desktop (1280x720) and mobile (Pixel 5).

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `api` | 8000:8000 | NestJS with hot reload (volume-mounted) |
| `frontend` | 4200:80 | Angular + nginx (proxies `/api/` to backend) |

Database is hosted on Supabase — no local `db` container needed.

### Environment Variables (`api/.env`)

Required: `DATABASE_URL`, `DIRECT_URL` (Supabase pooled/session), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`. Optional: `GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`.

## Skills

| Skill | Path | Purpose |
|-------|------|---------|
| Qdrant | `.claude/skills/qdrant.md` | Vector database operations with `@qdrant/js-client-rest` |
