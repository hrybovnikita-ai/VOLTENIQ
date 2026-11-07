# VOLTENIQ

Premium electronics e-commerce **demo** built with React + Vite, Tailwind CSS, Node.js + Express, and PostgreSQL + Prisma.

All prices are clearly labeled as **demo prices**. Checkout never collects card details or processes real payments.

## Stack

- **Frontend:** React 19, Vite, JavaScript, Tailwind CSS v4, React Router
- **Backend:** Node.js, Express, JWT auth, bcrypt password hashing, express-validator
- **Database:** PostgreSQL + Prisma (optional in-memory `DEMO_MODE` for local runs without Postgres)

## Features

- Landing page with hero, categories, and featured products
- Catalog with search, filters, sorting
- Product details, favorites, compare (up to 4), cart, demo checkout
- Login / sign up, profile, order history
- Admin dashboard (products + demo orders)
- AI shopping assistant UI (local demo replies; ready for future backend AI)

## Quick start (demo mode — no Postgres required)

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: [http://localhost:5000](http://localhost:5000)

`DEMO_MODE=true` uses in-memory seed data (default).

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

### Demo accounts

| Role  | Email                 | Password     |
|-------|-----------------------|--------------|
| User  | demo@volteniq.com     | password123  |
| Admin | admin@volteniq.com    | admin123     |

### Auth-protected Buy Now

- **Buy Now** on product pages and cart requires authentication.
- Guests are sent to **Sign Up** (or Sign In); after success they return to **demo checkout**.
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

### Backend (`backend/.env`)

| Variable        | Description                                      |
|-----------------|--------------------------------------------------|
| `PORT`          | API port (default `5000`)                        |
| `DEMO_MODE`     | `true` = in-memory store; `false` = Prisma/PG    |
| `DATABASE_URL`  | PostgreSQL connection string                     |
| `JWT_SECRET`    | Secret for signing JWTs                          |
| `JWT_EXPIRES_IN`| Token lifetime (default `7d`)                    |
| `CORS_ORIGIN`   | Allowed frontend origin                          |

### Frontend (`frontend/.env`)

| Variable         | Description                         |
|------------------|-------------------------------------|
| `VITE_API_URL`   | API base URL (`/api` via Vite proxy)|

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
