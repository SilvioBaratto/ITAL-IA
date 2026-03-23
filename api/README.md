# NestJS Backend

## Quick Start

```bash
npm install
npm run start:dev    # http://localhost:8000
```

## Key Commands

```bash
npm test                          # Run tests
npx prisma migrate dev            # Create + apply migration
npx prisma migrate deploy         # Apply migrations (production)
npx prisma generate               # Regenerate Prisma client
npx prisma studio                 # Visual DB editor
npx baml-cli generate             # Regenerate BAML client
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
