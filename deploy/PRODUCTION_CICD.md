# Production CI/CD

`main` is the production branch. Merging to `main` triggers
`.github/workflows/deploy-production.yml`, which (after a manual approval)
deploys:

- **backend** → AWS Lightsail Container Service `yumyum-backend` (us-east-1)
- **frontend** → AWS Amplify app `yumyum-ceviches` (us-east-1)

You can also run it on demand from the **Actions** tab (workflow_dispatch).

---

## One-time setup

### 1. Create the `production` Environment (enables the approval gate)
Repo → **Settings → Environments → New environment → `production`**.
Add yourself under **Required reviewers**. Without this, deploys run with no
approval pause.

### 2. Make sure the AWS targets exist
Run these once locally (they create the infra the workflow deploys into):
```bash
./deploy/lightsail-backend.sh --create      # creates the Lightsail container service
./deploy/amplify-frontend.sh  --create      # creates the Amplify app + main branch
```
You also need a **reachable managed MySQL** (Lightsail DB or RDS) — its host
goes in `PROD_DB_HOST`.

### 3. Add repository **secrets** (Settings → Secrets and variables → Actions → Secrets)

**Deploy account** (AWS CLI for lightsail/amplify):
| Secret | Notes |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user with Lightsail + Amplify permissions |
| `AWS_SECRET_ACCESS_KEY` | |

**Backend container env:**
| Secret | Notes |
|--------|-------|
| `PROD_DB_HOST` | managed MySQL host |
| `PROD_DB_USER` | optional (defaults to `root`) |
| `PROD_DB_PASSWORD` | |
| `PROD_DB_NAME` | optional (defaults to `restaurant_ordering`) |
| `PROD_JWT_SECRET` | strong random string |
| `PROD_FIREBASE_PROJECT_ID` | |
| `PROD_FIREBASE_SERVICE_ACCOUNT` | the **full service-account JSON**, inline (required — containers have no creds file) |
| `PROD_STRIPE_SECRET_KEY` | `sk_live_…` |
| `PROD_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `PROD_STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `PROD_CORS_ORIGIN` | e.g. `https://therollecito.com` |
| `PROD_S3_BUCKET` | prod uploads bucket |
| `PROD_S3_PUBLIC_URL_BASE` | optional (CloudFront/CDN base) |
| `PROD_S3_REGION` | e.g. `us-west-1` |
| `PROD_S3_ACCESS_KEY_ID` | app's S3 IAM key (separate from deploy key) |
| `PROD_S3_SECRET_ACCESS_KEY` | |

### 4. Add repository **variables** (same page → Variables tab) — frontend, public
| Variable | Notes |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | public Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_API_URL` | optional — defaults to the deployed backend URL; set only if you use a custom API domain |
| `VITE_SOCKET_URL` | optional — defaults to `VITE_API_URL` |

---

## Database migrations (automated, with a one-time baseline)
`deploy/db-migrate.sh` runs as a workflow step **before** the backend deploys:
it applies any `backend/database/migrations/*.sql` not yet recorded (tracked in
a `schema_migrations` table, each runs once) and re-loads
`stored_procedures.sql` every time (procedures are `DROP/CREATE`, so this keeps
prod SPs — like `sp_staff_update_password` — in sync).

**One-time baseline.** Your prod DB likely already has migrations 001–004
applied. Record them as applied **without** re-running them, once, before the
first automated deploy:
```bash
DB_HOST=<host> DB_USER=root DB_PASSWORD=<pw> DB_NAME=restaurant_ordering \
  ./deploy/db-migrate.sh --baseline
```
Skip this and the first deploy will try to re-run those `ALTER`s and fail.

**Reachability.** GitHub-hosted runners use dynamic IPs. The DB must be
reachable from them — enable public access + an IP allowlist on the managed DB,
or use a self-hosted runner inside the VPC. `DB_SSL_MODE=REQUIRED` is set in the
workflow so the connection uses TLS.

Extra secret needed for this step: `PROD_DB_PORT` (optional, defaults to 3306).

## How a deploy flows
1. Merge to `main` (or run the workflow manually).
2. The `deploy` job starts and **waits for your approval** (if reviewers are set).
3. On approval: apply DB migrations + SPs → build + push backend image → deploy
   container → resolve its URL → build frontend with that URL → deploy to Amplify.
