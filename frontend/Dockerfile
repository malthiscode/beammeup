FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.cjs ./
COPY index.html ./
COPY public ./public/
COPY src ./src/

RUN npm install --legacy-peer-deps && npm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install express http-proxy-middleware

COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
