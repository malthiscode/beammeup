FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src/

RUN npm install --legacy-peer-deps && npm run build

FROM node:24-alpine

WORKDIR /app

RUN npm install express

COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
