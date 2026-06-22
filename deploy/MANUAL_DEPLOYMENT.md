# Manual Production Deployment

This project does **not** use GitHub Actions. All production deploys are manual.

## Where production actually is

Verified 2026-09-11 against the live AWS account (637423348086):

| | |
|---|---|
| Host | Lightsail **instance** `therollecito-prod`, `44.242.113.98`, **us-west-2** |
| DNS | `api.therollecito.com` → `44.242.113.98` |
| Runs | `docker-compose.prod.yml` (backend + MySQL container) behind the host's TLS reverse proxy |
| Frontend | `frontend/` (Vite) → AWS Amplify. `frontend-next/` is a future rewrite, NOT production. |
| Images | Real AWS S3, bucket `the-rollecito-bkt`. No MinIO. |

### ⚠️ Open item: a second, unused backend exists

A Lightsail **Container Service** named `yumyum-backend` is also RUNNING in
**us-east-1** (deployment v6, 2026-07-01). Nothing points to it — its
`CORS_ORIGIN` is still an old `*.amplifyapp.com` URL. It is billed monthly.

`deploy/lightsail-backend.sh` and `deploy/deploy-all.sh` deploy to **that**
service, i.e. **not** to production. Do not run them expecting a live change.

Decide and then delete one side: either shut down the container service and keep
the compose instance, or repoint DNS at the container service and decommission
the instance. Until then, treat this document's table above as authoritative.

## Source of truth

Production:

- `docker-compose.prod.yml` — the production stack (backend + `db` MySQL container).
- `scripts/deploy-env.sh` — push `backend/.env.production` to the host and restart the backend.
- `deploy/db-migrate.sh` — apply DB migrations and reload stored procedures.
- `deploy/amplify-frontend.sh` — build and deploy the Vite frontend to Amplify.
- `backend/.env.production`, `frontend/.env.production` — gitignored, LIVE secrets.
- `./.env` on the server — gitignored, holds only `DB_PASSWORD` (see below).

Local development only:

- `docker-compose.yml` — MySQL, MinIO, backend, Vite frontend.
- `backend/.env`, `frontend/.env`.

Deprecated stubs that exit non-zero — do not use, safe to delete:

- `deploy/setup-aws.sh` — **this is what put MinIO into production.** It deployed
  `docker-compose.yml`, which starts MinIO and force-overrides
  `S3_ENDPOINT=http://minio:9000` in the backend's `environment:` block.
- `deploy/redeploy-backend.sh`.

Never deploy `docker-compose.yml` to production.

## Guardrails

Three independent layers now refuse a MinIO-flavoured production config:

1. `backend/src/config/env.js` — throws at startup if `NODE_ENV=production` and
   `S3_ENDPOINT` is set, `S3_BUCKET` is missing, or the bucket/public URL is a
   known dev value.
2. `deploy/lightsail-backend.sh` — same checks before deploying.
3. `scripts/deploy-env.sh` — same checks before pushing env to the server.

## ⚠️ This is a live database with real customer data

The production MySQL runs in a container on the host with an **existing volume
holding real client and order data**. Everything below is written to protect it.

`docker-compose.prod.yml` declares that volume `external: true`, so Compose will
never create it. If `DB_VOLUME` is wrong or unset, `up` fails and nothing
starts — instead of the far worse outcome of Compose creating a new empty
volume, running the initdb scripts into it, and serving the site from an empty
database while the real data sits orphaned.

Two values must describe what is ALREADY on the host, not what you want:

- `DB_PASSWORD` — on an existing volume MySQL **ignores** `MYSQL_ROOT_PASSWORD`;
  the password lives in the `mysql.user` table. This must be the password the
  live DB already uses.
- `DB_IMAGE` — must match the image the volume was initialized with. A different
  major version refuses to boot or silently triggers an in-place upgrade.

## The `./.env` file on the server

`docker-compose.prod.yml` needs a gitignored `.env` beside it containing:

```bash
DB_VOLUME=<name from `docker volume ls` on the host>
DB_IMAGE=<from `docker inspect <db-container> --format '{{.Config.Image}}'`>
DB_PASSWORD=<the password the live database ALREADY uses>
```

`DB_PASSWORD` is the single source of truth — Compose injects it into both the
`db` and `backend` services so they cannot drift, and it overrides the
`CHANGEME` placeholder in `backend/.env.production` (which is fine to leave).

## First-time cutover to this compose file

Do this once, carefully, before any routine deploy.

1. **Back up first. Non-negotiable.**

```bash
docker exec <db-container> mysqldump -u root -p<password> \
  --single-transaction --routines --triggers restaurant_ordering \
  > ~/backup-$(date +%F-%H%M).sql
ls -lh ~/backup-*.sql          # confirm it is NOT zero bytes
```

2. Record what is actually running, and fill in `./.env` from it:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}'
docker inspect <db-container> --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{end}}'
docker inspect <db-container> --format '{{.Config.Image}}'
```

3. Dry-run the config. This resolves variables without starting anything:

```bash
docker compose -f docker-compose.prod.yml config
```

4. Bring up the backend **only**, leaving the running DB container untouched:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker compose -f docker-compose.prod.yml logs --tail=30 backend
```

Confirm the log says `production`, not `development`, and that the app can read
existing orders. Only converge the `db` service (step 5) once that is verified.

5. Optional and disruptive — only if the DB container must be adopted into this
   compose file. It causes downtime and recreates the container (the data
   survives because the volume is external and pinned). Have the step-1 backup
   in hand:

```bash
docker compose -f docker-compose.prod.yml up -d db
```

## Routine deploy

Routine code deploys must **never** recreate the database container.

1. Ship code:

```bash
ssh -i ~/.ssh/lightsail/therollecito-deploy.pem ubuntu@44.242.113.98
cd ~/therollecito_prjct && git pull
```

2. Back up, then apply DB migrations. `--baseline` the first time on an
   already-populated DB, so existing migrations are recorded but not re-run:

```bash
docker exec <db-container> mysqldump -u root -p<password> \
  --single-transaction --routines --triggers restaurant_ordering \
  > ~/backup-$(date +%F-%H%M).sql

DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=<password> DB_NAME=restaurant_ordering \
  ./deploy/db-migrate.sh --baseline   # first time only; drop the flag after
```

`db-migrate.sh` needs network access to the DB. The `db` service is not
published to the host, so either run it inside the container's network or
temporarily publish 3306 on localhost.

3. Rebuild and restart the backend only — `--no-deps` is what keeps the DB
   container out of it:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker compose -f docker-compose.prod.yml logs --tail=30 backend
```

Confirm the log says `production`, not `development`.

Never use `docker compose down -v` on this host. `-v` deletes volumes.

4. Frontend — from your laptop, after setting `VITE_API_URL` in
   `frontend/.env.production`:

```bash
./deploy/amplify-frontend.sh --deploy
```

## Env-only change

To update secrets without shipping code, from your laptop:

```bash
./scripts/deploy-env.sh
```

## Known gaps

- **There is no script that deploys backend code**, only env (`deploy-env.sh`).
  Code ships via manual `git pull` on the host. This is the main reason the
  deploy process keeps drifting.
- `backend/.env.production` sets `CORS_ORIGIN=https://therollecito.com`, but
  `therollecito.com` resolves to Squarespace IPs, and the live backend is still
  running `CORS_ORIGIN=https://main.dp9rxmj9sat7d.amplifyapp.com`. Confirm which
  origin actually serves the app before relying on either.
- `AWS_REGION=us-west-1` in `backend/.env.production` while the instance is in
  us-west-2. Confirm it matches the `the-rollecito-bkt` bucket's real region.
- The Firebase service-account private key is stored in plaintext in the
  `yumyum-backend` container-service deployment environment. Rotate it.
