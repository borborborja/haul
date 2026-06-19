FROM node:24.1.0-alpine3.21 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.1.0-alpine3.21
RUN addgroup -S connector && adduser -S -G connector connector
WORKDIR /app
COPY --from=build --chown=connector:connector /app/package*.json ./
COPY --from=build --chown=connector:connector /app/node_modules ./node_modules
COPY --from=build --chown=connector:connector /app/dist ./dist
USER connector
CMD ["node", "dist/index.js"]
