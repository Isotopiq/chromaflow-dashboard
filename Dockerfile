# syntax=docker/dockerfile:1.7
# Production image for CHROMA.LAB (TanStack Start + Vite).
# Serves the built app via `vite preview` on port 5273.

# ---------- deps ----------
FROM oven/bun:1.3.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile || bun install

# ---------- builder ----------
FROM oven/bun:1.3.3-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---------- runtime ----------
FROM oven/bun:1.3.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5273
# Only the built SSR server output is needed at runtime. The Node SSR
# bundle lives at dist/server/server.js and self-contains its deps.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
EXPOSE 5273
# Run the actual SSR server (NOT `vite preview`, which only serves the
# static client bundle and would break server functions / /api routes).
CMD ["bun", "dist/server/server.js"]
