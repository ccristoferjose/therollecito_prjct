# Dev image for the Next.js 15 frontend. Mirrors the old frontend/Dockerfile
# approach: install fresh on linux (so native binaries match), then run the
# dev server bound to 0.0.0.0 so the host can reach it.
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching. --legacy-peer-deps mirrors the old app.
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --legacy-peer-deps

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000

CMD ["npx", "next", "dev", "-p", "3000", "-H", "0.0.0.0"]
