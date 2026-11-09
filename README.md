# VOLTENIQ

Premium electronics e-commerce **demo** built with React + Vite, Tailwind CSS, Node.js + Express, and PostgreSQL + Prisma.

All prices are clearly labeled as **demo prices**. Checkout never collects card details or processes real payments.

## Stack

- **Frontend:** React 19, Vite, JavaScript, Tailwind CSS v4, React Router
- **Backend:** Node.js, Express, JWT auth, bcrypt password hashing, express-validator
- **Database:** PostgreSQL + Prisma (accounts always use PostgreSQL; `DEMO_MODE` switches store data only)

## Features

- Landing page with hero, categories, and featured products
- Catalog with search, filters, sorting
- Product details, favorites, compare (up to 4), cart, demo checkout
- Login / sign up, profile, order history
- Admin dashboard (products + demo orders)
- AI shopping assistant UI (local demo replies; ready for future backend AI)

## Quick start (PostgreSQL)

### 1. Backend

For a fresh installation, configure PostgreSQL as described below. Keep the existing .env file when restarting a configured project.

```bash
cd backend
cp -n .env.example .env
npm install
npm run dev
```

API: [http://localhost:5004](http://localhost:5004)

The default, `DEMO_MODE=false`, stores accounts in PostgreSQL.

### 2. Frontend

```bash
cd frontend
cp -n .env.example .env
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

### First sign-in

Open [Create Account](http://localhost:5173/signup) to register an email and password. The PostgreSQL seed adds catalog products only. Accounts from an earlier in-memory run exist only in that process.

### Auth-protected Buy Now

- **Buy Now** on product pages and cart requires authentication.
- Guests are sent to **Sign In** and redirected to the main store after authentication.
- Checkout route is protected; orders API requires a JWT.
- Checkout never collects card details.

### Google Sign-In (real OAuth)

1. Create an OAuth 2.0 **Web client** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add authorized JavaScript origin: `http://localhost:5173`
3. Set the **same Client ID** in both env files:

```env
# backend/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# frontend/.env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

4. Restart backend and frontend. The Continue with Google button uses Google Identity Services and verifies the ID token on the server.

## PostgreSQL mode (Prisma)

1. Start Postgres (Docker example from repo root):

```bash
docker compose up -d
```

2. In `backend/.env`:

```env
DEMO_MODE=false
DATABASE_URL="postgresql://volteniq:volteniq@localhost:5432/volteniq?schema=public"
```

3. Migrate and seed:

```bash
cd backend
npx prisma generate
npm run db:setup
npm run dev
```

## Environment variables

### Backend (`backend/.env` / Vercel)

| Variable        | Description                                      |
|-----------------|--------------------------------------------------|
| `PORT`          | API port locally (default `5004`; ignored on Vercel) |
| `DEMO_MODE`     | `true` = in-memory store; `false` = Prisma/PG    |
| `DATABASE_URL`  | PostgreSQL / Neon connection string (secret)     |
| `JWT_SECRET`    | Strong secret (legacy fallback; sessions use cookies) |
| `JWT_EXPIRES_IN`| Unused by cookie sessions (default `7d`)         |
| `CORS_ORIGIN`   | Comma-separated allowed frontend origins         |
| `SESSION_SAME_SITE` | Only set `none` for cross-site API hosts     |
| `FIREBASE_PROJECT_ID` | Firebase project id for Google auth        |
| `NODE_ENV`      | `production` on Vercel                           |

### Frontend (`frontend/.env` / Vercel build)

| Variable         | Description                         |
|------------------|-------------------------------------|
| `VITE_API_URL`   | API base path; use `/api` in production (same origin) |
| `VITE_FIREBASE_*`| Optional Firebase web config        |

## Deploy on Vercel (Services)

Vercel Services (Beta) deploys the Vite frontend and Express API as one project. Root `vercel.json` routes `/api/*` to `backend` and everything else to `frontend`, with SPA fallbacks for React Router (`/login`, `/signup`, `/catalog`, `/profile`, …).

### Exact steps

1. Create a Neon (or other hosted) PostgreSQL database. Copy the **pooled** connection string with `sslmode=require`.
2. From a machine that can reach Neon, apply the schema **without wiping data**:
   ```bash
   cd backend
   DATABASE_URL="postgresql://..." npx prisma db push
   # Optional only on an empty catalog:
   # DATABASE_URL="postgresql://..." npm run prisma:seed
   ```
3. In [Vercel](https://vercel.com): **Add New Project** → import `hrybovnikita-ai/VOLTENIQ` → root directory stays the repo root (do not set Root Directory to `frontend`).
4. Confirm Vercel detects `vercel.json` Services (`frontend` + `backend`).
5. Project → **Settings → Environment Variables** (Production + Preview). Set:

| Name | Service / notes |
|------|-----------------|
| `DATABASE_URL` | Backend; Neon pooled URL (secret) |
| `DEMO_MODE` | `false` |
| `JWT_SECRET` | Long random secret (secret) |
| `CORS_ORIGIN` | Your production origin(s), e.g. `https://your-app.vercel.app` |
| `FIREBASE_PROJECT_ID` | Optional; match Firebase |
| `VITE_API_URL` | `/api` (frontend build) |
| `VITE_FIREBASE_*` | Optional Firebase web keys |

6. Do **not** commit `.env` files. Do **not** put `DATABASE_URL` or `JWT_SECRET` in the repo.
7. Deploy (`git push` to `main` or **Deploy** in the dashboard).
8. After deploy, verify:
   - `GET https://<deployment>/api/health`
   - Catalog loads
   - `/login`, `/signup`, `/catalog`, `/profile` deep links
   - Register → cookie session → `/api/auth/me` → cart

Same-origin `/api` uses Secure HttpOnly `__Host-volteniq_session` cookies (`SameSite=Lax`). Preview URLs are also allowed when `VERCEL_URL` is present.
## API overview

- `GET /api/health`
- `GET /api/products` · `GET /api/products/:id` · `GET /api/products/compare`
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET|POST /api/orders` (auth)
- `GET /api/favorites` · `POST /api/favorites/toggle` (auth)
- `GET|POST|PUT|DELETE /api/admin/...` (admin)

## Project structure

```
Volteniq/
├── backend/          Express API + Prisma
├── frontend/         React + Vite app
├── docker-compose.yml
└── README.md
```

## Scripts

**Backend:** `npm run dev` · `npm start` · `npm run db:setup` · `npm run prisma:seed`  
**Frontend:** `npm run dev` · `npm run build` · `npm run preview` · `npm run lint`

## Notes

- This is a **portfolio / learning demo**, not a production storefront.
- Do not enter real payment information anywhere in the app.
- Orange accent `#FF7900`, graphite/black/silver palette, glassmorphism UI with light/dark themes.

## MongoDB Atlas store storage

Set `MONGODB_URI` in the ignored `backend/.env` using the Atlas database user password, URL-encoded if needed. Grant the application access to the dedicated `volteniq_store` database and allow the backend host in Atlas Network Access. Restart the API after changing its environment.

From `backend`, run `npm run mongo:check` to verify authentication and ping without writing data. Supply a separate `MONGODB_SYNC_URI` to the operator job and run `npm run mongo:sync` to publish a consistent PostgreSQL snapshot of products, categories, favorites, and demo order summaries. Refresh the snapshot explicitly after changes. Use this database exclusively for VOLTENIQ. The sync replaces managed snapshots transactionally and preserves saved carts. Account rows, password hashes, shipping addresses, and payment details are excluded.

PostgreSQL remains authoritative for authentication, favorites, catalog prices, stock, and order history. The category endpoint reads published MongoDB categories and falls back to the built-in taxonomy when unavailable. Guest and existing browser carts retain their local storage behavior.

The authenticated saved-cart API uses the PostgreSQL JWT. GET `/api/cart` returns `items` and `version`. PUT `/api/cart` takes the last-read version and up to 100 lines with `productId`, positive integer `quantity`, and a `selection` object containing variant strings. An absent cart starts at version zero. A stale version returns 409; unavailable storage returns 503. Checkout calculates prices from the live catalog.

Database runtime roles, maintenance identities and rollout instructions are in [the database security runbook](backend/security/DEPLOY.md).
