FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts/build-accounts.mjs scripts/build-accounts.mjs
COPY src/accounts src/accounts
COPY dist dist
RUN npm run build:accounts
RUN npm prune --omit=dev
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=4173 BIND_HOST=0.0.0.0 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY package.json ./
COPY server server
COPY src/accounts/core.js src/accounts/core.js
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4173
CMD ["node","server/start.mjs"]
