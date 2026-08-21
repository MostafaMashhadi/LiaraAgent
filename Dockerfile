# Multi-stage Dockerfile for Liara Helper Agent

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/vite-monorepo

COPY vite-monorepo/package.json vite-monorepo/pnpm-lock.yaml vite-monorepo/pnpm-workspace.yaml ./
COPY vite-monorepo/apps/test-ui/package.json ./apps/test-ui/
COPY vite-monorepo/packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY vite-monorepo/apps/test-ui/ ./apps/test-ui/
COPY vite-monorepo/packages/ui/ ./packages/ui/

WORKDIR /app/vite-monorepo/apps/test-ui
RUN pnpm run build

# Stage 2: Build Go backend
FROM golang:1.23-alpine AS builder

WORKDIR /app

ENV GOTOOLCHAIN=auto

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
COPY --from=frontend-builder /app/web/dist /app/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/server ./cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/cli ./cmd/cli/main.go

# Stage 3: Production runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata bash curl

WORKDIR /app

COPY --from=builder /app/bin/server /app/server
COPY --from=builder /app/bin/cli /app/cli
COPY --from=builder /app/data /app/data
COPY --from=builder /app/web/dist /app/web/dist
COPY --from=builder /app/web/fallback /app/web/fallback

ENV PORT=8080 \
    DOCS_DIR=/app/data/docs/src/pages \
    INDEX_PATH=/app/data/index.json \
    DATABASE_URL=postgres://liara:liarapass@postgres:5432/liaradb?sslmode=disable \
    JWT_SECRET=liara-agent-jwt-super-secret-key-2026 \
    ADMIN_EMAIL=admin@liara.ir \
    ADMIN_PASSWORD=Admin@Liara2026!

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/server"]
