# Gold Mine — Task List

## Status: COMPLETED

### Delivered Features

- [x] Login with **username + password only** (no email field)
- [x] Registration with unique username validation (DB UNIQUE + live check)
- [x] Show/Hide password toggle on login, register, and profile
- [x] Secure password hashing (bcrypt, 12 rounds)
- [x] User dashboard with 7 stat cards + live auto-refresh (10s polling)
- [x] Active investments list + pending withdrawals count
- [x] Redeem Code page with validation and reuse prevention
- [x] Support Center: contact form, FAQ, ticket submission & history
- [x] Download App page: APK button, iOS placeholder, install instructions
- [x] Comments/Recommendations with pending/approved/rejected moderation
- [x] Full Admin Portal (password: **8920**)
- [x] Admin: users, investments, deposits, withdrawals, codes, comments, support, audit
- [x] CSRF protection, rate limiting, Helmet, JWT httpOnly cookies
- [x] Responsive UI, dark/light mode, toast notifications

### Test Accounts

- **Admin:** `admin` / `8920` (must change password on first login)
- **Demo:** `demo` / `demo123`

### How to Run

```bash
npm run install:all
npm run db:generate
npm run db:push
npm run db:seed

# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:web
```

Open http://localhost:3000

Or one command: `npm run dev`
