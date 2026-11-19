# Yemekhane · uygulama servisi (Node.js + Express, yalnızca JSON döner)
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Önce yalnızca bağımlılık listesi kopyalanır: kod değişince npm install yeniden çalışmaz
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

EXPOSE 8000
CMD ["node", "src/sunucu.js"]
