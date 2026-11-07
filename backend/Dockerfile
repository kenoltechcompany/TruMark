# ============================================================
# TruMark Backend - Multi-stage Docker build
# Stage 1: Build the NestJS application with Prisma
# Stage 2: Lean production image with only runtime deps
# ============================================================
ARG NODE_VERSION=22-alpine

# ── Stage 1: Install & Build ──
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock* ./
COPY prisma.config.ts ./

# Install ALL dependencies (including dev for prisma generate + nest build)
RUN npm install --include=dev

# Copy source code
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma Client and build NestJS
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production image ──
FROM node:${NODE_VERSION}

WORKDIR /app

# Copy built artifacts and production node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/main.js"]
