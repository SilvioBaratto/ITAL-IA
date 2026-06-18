# ── Development stage (used by docker-compose for hot-reload) ──
FROM node:22-alpine AS dev

WORKDIR /app

# Copy package files and install ALL dependencies (including devDependencies)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps --ignore-scripts; else npm install --legacy-peer-deps --ignore-scripts; fi

# Copy source (pre-generated clients included in build context)
COPY . .
# Use pre-generated clients from build context to avoid network/TLS downloads
# Run with --no-engine to skip engine binary download (schema-engine not needed at runtime)
RUN npx prisma generate --no-engine || true

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# ── Build stage (compiles TypeScript for production) ──
FROM dev AS builder

RUN npm run build

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy package files and lockfile from builder, install prod deps only
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts

# Copy generated clients and built application from builder
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/baml_client ./baml_client
COPY --from=builder /app/baml_src ./baml_src

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Change ownership
RUN chown -R appuser:appgroup /app /entrypoint.sh

# Switch to non-root user
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/src/main"]
