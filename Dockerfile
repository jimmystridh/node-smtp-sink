# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build
COPY . .
RUN npm run build

# Prune dev deps
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 1025 1080
ENTRYPOINT ["node", "/app/dist/cli.js"]
# Pass flags to CLI via Docker CMD or docker run args
CMD []
