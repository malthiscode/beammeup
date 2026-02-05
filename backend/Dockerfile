# Build stage
FROM node:24-bullseye-slim AS builder

WORKDIR /app

# Install OpenSSL 1.1 (required by Prisma v5 native engine)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl1.1 ca-certificates \
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

# Production stage
FROM node:24-bullseye-slim

WORKDIR /app

# Install OpenSSL 1.1 (required by Prisma v5 native engine)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl1.1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies (keep dev for prisma CLI)
RUN npm install --legacy-peer-deps

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

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
