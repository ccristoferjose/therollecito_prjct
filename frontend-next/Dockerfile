# syntax=docker/dockerfile:1.6
# Dev image for the Next.js frontend (docker-compose.yml `frontend` service).
FROM node:20-slim

WORKDIR /app

# Copy the lockfile too. Without it npm re-resolved the whole dependency tree
# against the registry on every build, which took minutes.
#
# `npm install`, not `npm ci`: the lockfile is generated on macOS and lacks
# a few optional linux-only entries (@emnapi/core and @emnapi/runtime, pulled
# in by wasm fallbacks), so `npm ci` refuses with "not in sync". npm install
# still honours every pinned version in the lockfile and only resolves those
# gaps — same reasoning as amplify.yml.
COPY package.json package-lock.json ./

# The cache mount keeps npm's tarballs between builds; --prefer-offline uses
# them without re-checking the registry.
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit --no-fund

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

CMD ["npx", "next", "dev", "-p", "3000", "-H", "0.0.0.0"]
