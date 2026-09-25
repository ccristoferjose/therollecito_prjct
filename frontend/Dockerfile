# syntax=docker/dockerfile:1.6
FROM node:20-slim

WORKDIR /app

# Install from the lockfile with `npm ci`.
#
# This used to copy only package.json and run `npm install`, because an older
# lockfile generated on macOS lacked the linux native binaries (npm/cli #4828).
# The current lockfile records every platform's optional binaries —
# @rolldown/binding-linux-*, @tailwindcss/oxide-linux-*, lightningcss-linux-*
# — so npm ci picks the right one for this image. Skipping the lockfile meant
# npm re-resolved the whole dependency tree against the registry on every
# build (~4 minutes); npm ci only downloads the pinned tarballs.
#
# If a future lockfile is missing a linux binary, regenerate it with
# `npm install` (not a partial update) rather than dropping the lockfile here.
COPY package.json package-lock.json ./

# The cache mount keeps npm's tarball cache between builds, so rebuilding
# after a dependency change only downloads what changed. --prefer-offline
# uses those cached tarballs without re-checking the registry.
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
      --prefer-offline \
      --no-audit \
      --no-fund

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
