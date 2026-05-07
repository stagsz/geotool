FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY render-service/package.json ./
RUN npm install

COPY render-service/src/ ./src/
COPY render-service/tsconfig.json ./

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
