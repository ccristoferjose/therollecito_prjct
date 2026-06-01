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

## ⚠️ Database migrations are NOT automated
The workflow ships application code only. Schema changes and new stored
procedures (e.g. `sp_staff_update_password`) must be applied to the production
DB manually:

```bash
mysql -h <PROD_DB_HOST> -uroot -p restaurant_ordering < backend/database/migrations/00X_*.sql
mysql -h <PROD_DB_HOST> -uroot -p restaurant_ordering < backend/database/stored_procedures.sql
```
Do this **before** approving a deploy that depends on the new objects.

## How a deploy flows
1. Merge to `main` (or run the workflow manually).
2. The `deploy` job starts and **waits for your approval** (if reviewers are set).
3. On approval: build + push backend image → deploy container → resolve its URL
   → build frontend with that URL → deploy to Amplify.
