FROM node:22-bookworm-slim

# better-sqlite3 kerak bo'lsa kompilyatsiya qila olishi uchun
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

COPY . .

ENV NODE_ENV=production \
    ADMIN_HOST=0.0.0.0 \
    ADMIN_PORT=3000

EXPOSE 3000

# Baza va rasmlar /app/storage ichida: shu papkaga volume ulanadi
CMD ["node", "src/index.js"]
