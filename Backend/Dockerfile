FROM node:24-bookworm-slim

# Install Chromium's Linux libraries and fonts in the deploy image itself.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tini unzip fonts-liberation fonts-noto-color-emoji \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
    libxrender1 libxshmfence1 libxss1 libxtst6 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer \
    PUPPETEER_NO_SANDBOX=true

WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json .npmrc .puppeteerrc.cjs ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node server.js ./
COPY --chown=node:node src ./src

EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["npm", "start"]
