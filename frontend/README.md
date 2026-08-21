# Liara Agent frontend (pnpm workspace)

## Apps

- `apps/web` — main React UI (Vite + Tailwind). Builds into `../web/dist` for the Go server.

## Packages

- `packages/ui` — shared UI primitives (`@workspace/ui`)

## Scripts

```bash
pnpm install
pnpm dev      # Vite dev server on :5173 (proxies /api and /ws to :8080)
pnpm build    # production build → ../../web/dist
```

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add button -c packages/ui
```
