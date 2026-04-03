# CLAUDE.md

This file provides guidance to Claude Code when working with this NestJS API.

## Build and run

```bash
npm install
npm run start:dev                # Dev server on :3005
npm run start:debug              # Dev with debugger
npm run build                    # Production build (nest build)
npm test                         # Jest unit tests
npm run test:watch               # Watch mode
npm run test:cov                 # Coverage report
npx prisma migrate dev           # Create + apply migration
npx prisma migrate deploy        # Apply migrations (production)
npx prisma generate              # Regenerate Prisma client
npx prisma studio                # Visual DB editor
npx baml-cli generate            # Regenerate BAML client after editing baml_src/
```

## Architecture

NestJS 11 app with two entry points: `main.ts` (local, port 3005) and `serverless.ts` (Vercel, singleton Express).

### Request pipeline

Helmet -> CORS -> `/api/v1` prefix -> LoggingMiddleware -> ThrottlerGuard (100 req/60s) -> SupabaseAuthGuard (global, bypass with `@Public()`) -> ZodValidationPipe -> route handler -> ZodSerializerInterceptor -> HttpExceptionFilter + PrismaClientExceptionFilter

### Modules

`auth`, `chatbot`, `chat-conversation`, `region`, `poi`, `saved-items`, `qdrant`, `health`, `test`. See root `CLAUDE.md` for details on each.

### Key patterns

- **Database**: PrismaService (extends PrismaClient with PrismaPg adapter for Supabase pooling). PrismaModule is `@Global()`.
- **Models**: `prisma/schema.prisma` — Region, PointOfInterest, SavedItem, ChatConversation, ChatMessage. Regenerate with `npx prisma generate`.
- **DTOs**: `Create<Entity>Dto` / `Update<Entity>Dto` / `<Entity>ResponseDto`. Zod-based via nestjs-zod.
- **BAML**: Define LLM functions in `baml_src/*.baml`. Only `StreamRAGChat` is used at runtime (GPT-5 Mini). Never edit `baml_client/`.
- **Path aliases**: `@/*` -> `src/*`, `@generated/prisma`, `@generated/zod`.
