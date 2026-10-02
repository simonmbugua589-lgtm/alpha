# Gold Mine — Investment Platform v2

Modern full-stack investment platform built with **Next.js 15**, **Express**, **Prisma**, and **SQLite** (swap to PostgreSQL/MySQL in production by changing `datasource` in `prisma/schema.prisma`).

## Quick start

```bash
# From project root
npm run install:all
npm run db:generate
npm run db:push
npm run db:seed

# Terminal 1 — API (port 4000)
npm run dev:api

# Terminal 2 — Web (port 3000)
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

Or use one command (requires `concurrently`):

```bash
npm install
npm run dev
```

## Default accounts

| Role  | Username | Password | Notes |
|-------|----------|----------|--------|
| Admin | `admin` | `8920` | Must change password on first login |
| Demo user | `demo` | `demo123` | Sample balance & Gold plan |

## Project structure

```
prisma/           Schema, migrations, seed
backend/          Express REST API + JWT cookies
frontend/         Next.js App Router UI
index.html        Legacy offline client (optional)
server.js         Legacy Express + SQLite server (optional)
```

## Environment

Copy root `.env` for the API. Frontend uses `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

The Next.js app rewrites `/api/*` to the backend when `NEXT_PUBLIC_API_URL` is set.

## Features

- **Username-only** registration and login (unique username, bcrypt hashing)
- User dashboard with live stats, plans, deposit/withdraw, redeem codes, transactions, profile, support, comments, download app
- Toast notifications, dark/light mode, responsive layout
- Separate **Admin Portal** (`/admin`): users, investments, deposits, withdrawals, plans, codes, comments, support, monitoring, audit logs, site settings
- Security: bcrypt, JWT httpOnly cookies, CSRF tokens, RBAC, rate limiting, Helmet, audit logging

## Production notes

- Set strong `JWT_SECRET` and `NODE_ENV=production`
- Use PostgreSQL/MySQL and run `prisma migrate deploy`
- Serve Next.js and API behind HTTPS; set `FRONTEND_URL` and `secure` cookies
