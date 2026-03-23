# ITAL-IA — Discover Italy's Regions

An AI-powered platform for discovering Italy's regions — culture, events, food, spritz, and hidden gems. Chat with a context-aware assistant backed by a curated knowledge base for each region.

**Starting with:** Friuli Venezia Giulia

## Features

- **AI Chatbot** -- RAG-powered assistant with knowledge of regional culture, food, events, and places. Streams responses in real time via SSE.
- **Regional Knowledge Base** -- Curated, web-scraped content organized by category (culture, cities, food & wine, events, nature, practical info).
- **Authentication** -- Supabase Auth with JWT validation, route guards, and automatic token refresh.
- **Mobile-First** -- Responsive design tested on desktop and mobile viewports.

## Tech Stack

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| Backend        | NestJS 11, Prisma ORM, Zod validation  |
| Frontend       | Angular 21, Signals, Tailwind CSS 4    |
| Database       | Supabase (PostgreSQL)                  |
| Vector Search  | Qdrant (`italia-kb` collection)        |
| AI/LLM         | BAML (Claude Haiku), OpenAI embeddings |
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
├── api/                    # NestJS backend
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       #   Supabase JWT authentication
│   │   │   ├── chatbot/    #   RAG pipeline + SSE streaming
│   │   │   ├── itinerary/  #   Trip/day/activity CRUD (dormant)
│   │   │   ├── qdrant/     #   Vector similarity search
│   │   │   └── health/     #   Health check endpoint
│   │   ├── prisma/         # Global database service
│   │   └── common/         # Guards, filters, interceptors, decorators
│   ├── prisma/             # Schema + migrations
│   └── baml_src/           # LLM function definitions
├── frontend/               # Angular SPA
│   ├── src/app/
│   │   ├── pages/          # Chatbot view
│   │   ├── services/       # Auth, Chat services
│   │   ├── guards/         # Route protection
│   │   ├── interceptors/   # JWT injection + 401 handling
│   │   └── shared/         # Layout, sidebar, reusable components
│   └── e2e/                # Playwright tests
├── kb/                     # Knowledge base content
│   ├── links.csv           # Source URLs by category
│   ├── scrape.ts           # Web scraper (Jina API)
│   └── scraped/            # Raw markdown per category
└── docker-compose.yml
```

### Backend Pipeline

All routes are prefixed with `/api/v1` and protected by Supabase JWT authentication (opt-out via `@Public()` decorator).

**Middleware stack:** Helmet &rarr; CORS &rarr; ThrottlerGuard (100 req/60s) &rarr; ZodValidationPipe &rarr; Exception filters &rarr; Response transform

**Chat flow:** User query &rarr; OpenAI embedding &rarr; Qdrant similarity search (`italia-kb`) &rarr; BAML `StreamRAGChat()` (Claude Haiku, parameterized by region) &rarr; SSE stream to client

### Knowledge Base Pipeline

```
kb/links.csv → scrape.ts → kb/scraped/{category}/*.md → chunk-pages.ts → kb/chunked/ → upload-to-qdrant.ts → Qdrant (italia-kb)
```

Each vector payload includes a `region` field for future multi-region filtering.

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

The application deploys to **Vercel** via GitHub Actions. Pushes to `main` trigger automatic deployments for both the API and frontend.

## License

MIT
