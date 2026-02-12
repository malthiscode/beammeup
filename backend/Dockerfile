# Build stage
FROM node:22-bullseye-slim AS builder

WORKDIR /app

# Install OpenSSL 1.1 (required by Prisma v5 native engine) and build tools for node-gyp
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libssl1.1 \
       ca-certificates \
       python3 \
       make \
       g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/

# Install all dependencies (including dev)
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --omit=dev

# Production stage
FROM node:22-bullseye-slim

WORKDIR /app

# Install OpenSSL 1.1 (required by Prisma v5 native engine) and Docker CLI
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libssl1.1 \
       ca-certificates \
       curl \
       gnupg \
       lsb-release \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Copy production node_modules from builder (pre-pruned)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist/

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create data directory
RUN mkdir -p data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
