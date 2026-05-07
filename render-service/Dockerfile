FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
COPY render-service/package.json ./render-service/

RUN npm ci --workspace=render-service

COPY render-service/ ./render-service/

RUN npm run build --workspace=render-service

EXPOSE 3001

CMD ["node", "render-service/dist/index.js"]
