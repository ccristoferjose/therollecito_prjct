# syntax=docker/dockerfile:1.6
FROM node:20-alpine

WORKDIR /app

# npm ci installs exactly what package-lock.json pins, without re-resolving
# the tree against the registry. The backend has no native modules, so the
# macOS-generated lockfile installs cleanly on alpine. The cache mount keeps
# npm's tarballs between builds so a dependency change only downloads what
# changed.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --prefer-offline --no-audit --no-fund

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/server.js"]
