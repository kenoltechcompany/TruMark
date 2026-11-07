# ============================================================
# TruMark Frontend - Multi-stage Docker build
# Stage 1: Build static assets with Vite
# Stage 2: Serve with Nginx alpine
# ============================================================
ARG NODE_VERSION=22-alpine

# ── Stage 1: Build ──
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Copy dependency manifests and install
COPY package.json bun.lock* ./
RUN npm install

# Copy source and build
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Nginx ──
FROM nginx:stable-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config that proxies /api to the backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
