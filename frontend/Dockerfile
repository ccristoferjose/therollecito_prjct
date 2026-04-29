# syntax=docker/dockerfile:1.6
FROM node:20-slim

WORKDIR /app

# Copy only package.json — see long comment below about why not the lockfile.
# The host lockfile is from macOS/darwin-arm64 and pins platform-specific
# native binaries, so reinstalling it on linux skips the ones we need
# (npm/cli #4828). Letting npm resolve fresh on linux picks the right
# native binary (e.g. @rollup/rollup-linux-arm64-gnu on node:20-slim).
COPY package.json ./

# --mount=type=cache persists npm's package tarball cache BETWEEN image
# builds, so the second+ time this layer rebuilds it pulls from cache
# instead of re-downloading every tarball.
# --prefer-offline uses the cache when a package is available.
# --no-audit / --no-fund skip the two slowest post-install chores.
RUN --mount=type=cache,target=/root/.npm \
    npm install \
      --include=optional \
      --legacy-peer-deps \
      --no-audit \
      --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
