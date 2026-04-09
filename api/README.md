# NestJS Backend

## Quick Start

```bash
npm install
npm run start:dev    # http://localhost:3005
```

## Key Commands

```bash
npm test                          # Run tests
npx prisma generate               # Regenerate Prisma client (no DB access)
npx prisma studio                 # Visual DB editor
npx baml-cli generate             # Regenerate BAML client
```

> **Do not run `npx prisma migrate dev` or `prisma migrate deploy` on this project.**
> They hang on Supabase (the pooler doesn't allow shadow DB creation, and
> `DATABASE_URL` points at the 6543 transaction pooler which is incompatible
> with Prisma migrations). See the "Database migrations" section below.

## Database migrations

This project talks to hosted Supabase through a connection pooler. Runtime
code uses the **transaction pooler** (`DATABASE_URL`, port 6543) for efficient
pooling across serverless cold starts, but that pooler hangs Prisma migration
commands indefinitely. Prisma CLI work must go through the **session pooler**
(`DIRECT_URL`, port 5432).

The workflow: hand-write the SQL, apply it via `prisma db execute` with an
inline env override, then mark it as applied.

### Step by step

1. **Edit `prisma/schema.prisma`** — add/remove/rename fields.

2. **Create the migration folder + file** by hand:
   ```
   prisma/migrations/{YYYYMMDDHHMMSS}_{short_name}/migration.sql
   ```
   Use a timestamp newer than every existing migration so Prisma applies it
   last. Write plain SQL (`ALTER TABLE`, `CREATE INDEX`, `ALTER TYPE ... ADD
   VALUE`, …) and leave a short comment at the top explaining the *why*.

3. **Apply it** against the session pooler:
   ```bash
   DIRECT=$(grep '^DIRECT_URL=' .env | cut -d'=' -f2- | sed 's/^"//;s/"$//')
   DATABASE_URL="$DIRECT" npx prisma db execute \
     --file prisma/migrations/{folder}/migration.sql
   ```
   The `DATABASE_URL="$DIRECT"` override is load-bearing — without it, Prisma
   picks up the 6543 pooler from `.env` and hangs.

4. **Mark the migration as applied** so `_prisma_migrations` stays in sync:
   ```bash
   DATABASE_URL="$DIRECT" npx prisma migrate resolve \
     --applied {migration_folder_name}
   ```

5. **Regenerate the Prisma client** (no DB access — no override needed):
   ```bash
   npx prisma generate
   ```

6. **Type-check** to catch code still referencing removed/renamed fields:
   ```bash
   npx tsc --noEmit
   ```

### Example

```sql
-- prisma/migrations/20260409110000_remove_poi_neighborhood_latlng/migration.sql
-- Rationale: the deep-research KB doesn't provide per-venue coordinates and
-- rarely names a quartiere. Dropping the nullable placeholders.

ALTER TABLE "points_of_interest" DROP COLUMN "neighborhood";
ALTER TABLE "points_of_interest" DROP COLUMN "latitude";
ALTER TABLE "points_of_interest" DROP COLUMN "longitude";
```

### Notes

- `prisma/migrations/migration_lock.toml` must exist (tells Prisma this is a
  Postgres project). Do not delete it.
- Migration folders are named `{YYYYMMDDHHMMSS}_snake_case_description` — the
  timestamp determines apply order.
- If you want a quick sanity-check of what's in the DB right now, use the
  **session pooler** version:
  ```bash
  DATABASE_URL="$DIRECT" npx prisma studio
  ```

## Architecture

```
src/
├── main.ts               # Bootstrap, Swagger, Helmet, CORS
├── app.module.ts          # Root module
├── prisma/                # Global PrismaModule + PrismaService
├── common/
│   ├── decorators/        # @CurrentUser, @Public
│   ├── middleware/         # Logging middleware
│   ├── filters/           # Exception filters
│   ├── exceptions/        # Custom API exceptions
│   └── interceptors/      # Response transform
└── modules/
    ├── health/            # Health check endpoint
    ├── auth/              # Authentication
    ├── test/              # CRUD test endpoints
    └── chatbot/           # BAML-powered chatbot

prisma/schema.prisma       # Database models
baml_src/                  # BAML LLM function definitions
baml_client/               # Auto-generated BAML client (don't edit)
```
