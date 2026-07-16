FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node public ./public
COPY --chown=node:node src ./src

RUN mkdir -p /app/data /app/storage/catalog /app/storage/uploads /app/storage/orders /app/storage/emails \
    && chown -R node:node /app/data /app/storage

USER node
EXPOSE 3000

CMD ["sh", "-c", "node src/setup-database.js && exec node src/server.js"]
