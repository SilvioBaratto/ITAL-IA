# CLAUDE.md

This file provides guidance to Claude Code when working with this NestJS API.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run start:dev

# Run with debug
npm run start:debug

# Build for production
npm run build

# Run tests
npm test

# Database migrations
npx prisma migrate dev        # Create and apply migration (dev)
npx prisma migrate deploy     # Apply migrations (production)
npx prisma generate           # Regenerate Prisma client

# Prisma Studio (visual DB editor)
npx prisma studio

# Regenerate BAML client (after modifying .baml files)
npx baml-cli generate
```

## Architecture Overview

This is a NestJS application with BAML-powered AI chatbot functionality.

### Core Structure

```
src/
├── main.ts               # Bootstrap, Swagger, Helmet, CORS, ValidationPipe
├── app.module.ts          # Root module (Prisma, Config, Throttler)
├── prisma/
│   ├── prisma.module.ts   # @Global() PrismaModule
│   └── prisma.service.ts  # PrismaService (extends PrismaClient)
├── common/
│   ├── decorators/        # Custom decorators (@CurrentUser, @Public)
│   ├── middleware/         # Logging middleware
│   ├── filters/           # Exception filters (HTTP, Prisma)
│   ├── exceptions/        # Custom API exceptions
│   └── interceptors/      # Response transform interceptor
└── modules/
    ├── health/            # Health check endpoint
    ├── auth/              # Authentication (stub in base, replaced by overlays)
    ├── test/              # CRUD test endpoints
    └── chatbot/           # BAML-powered chatbot

prisma/
└── schema.prisma          # Database models

baml_src/                  # BAML definitions for LLM functions
baml_client/               # Auto-generated BAML TypeScript client (don't edit)
```

### Key Patterns

**Database Access**: PrismaService injected via DI. PrismaModule is @Global.

**Models**: Defined in `prisma/schema.prisma`. Regenerate client with `npx prisma generate`.

**API Routes**: All v1 routes go through `/api/v1` prefix set in controllers.

**BAML Integration**: Define LLM functions in `baml_src/*.baml`, regenerate client with `npx baml-cli generate`.

**DTO Naming**: `Create<Entity>Dto`, `Update<Entity>Dto`, `<Entity>ResponseDto` pattern (Zod-based via nestjs-zod).

### Middleware Stack

1. Helmet (security headers)
2. CORS
3. Throttler (rate limiting)
4. Logging middleware
5. ZodValidationPipe (global)
6. HttpExceptionFilter + PrismaClientExceptionFilter (global)
7. TransformInterceptor (global)
