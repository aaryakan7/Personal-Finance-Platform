FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
COPY server.js ./server.js

USER node
EXPOSE 4000

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
