# Multi-stage Dockerfile for Liara Helper Agent

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/.npmrc ./
COPY frontend/apps/web/package.json ./apps/web/
COPY frontend/packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY frontend/apps/web/ ./apps/web/
COPY frontend/packages/ui/ ./packages/ui/
COPY frontend/tsconfig.json ./

WORKDIR /app/frontend/apps/web
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

# Ensure docs directory exists (and clone official Liara docs if not present locally)
RUN if [ ! -d "/app/data/docs/src/pages" ]; then \
      git clone --depth 1 https://github.com/liara-cloud/docs.git /app/data/docs || mkdir -p /app/data/docs/src/pages; \
    fi

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/server ./cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/cli ./cmd/cli/main.go

# Stage 3: Production runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata bash curl git

WORKDIR /app

COPY --from=builder /app/bin/server /app/server
COPY --from=builder /app/bin/cli /app/cli
# Documentation is application content and must stay outside the persistent
# index volume. Mounting a volume on /app/data would otherwise hide these files
# at runtime and leave the document search API with nothing to index.
COPY --from=builder /app/data/docs /app/docs
COPY --from=builder /app/web/dist /app/web/dist
COPY --from=builder /app/web/fallback /app/web/fallback

ENV PORT=8080 \
    REPO_DIR=/app/docs \
    DOCS_DIR=/app/docs/src/pages \
    INDEX_PATH=/app/data/index.json \
    JWT_SECRET=liara-agent-jwt-super-secret-key-2026 \
    ADMIN_EMAIL=admin@liara.ir \
    ADMIN_PASSWORD=Admin@Liara2026!

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/server"]
