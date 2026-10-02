/**
 * Gold Mine — Express + SQLite backend
 * Secure auth, unique usernames, parameterized queries (SQL injection safe)
 */

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "gold-mine-dev-secret-change-in-production";
const ROOT = __dirname;

/* ---------- Database ---------- */
const db = new Database(path.join(ROOT, "goldmine.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    banned INTEGER NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    invested REAL NOT NULL DEFAULT 0,
    monthly_earnings REAL NOT NULL DEFAULT 0,
    total_withdrawn REAL NOT NULL DEFAULT 0,
    today_earnings REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS redeem_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    amount REAL NOT NULL,
    used_by TEXT REFERENCES users(id),
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    amount REAL NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    created_at INTEGER NOT NULL
  );
`);

function uid() {
  return crypto.randomUUID();
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    banned: !!row.banned,
    balance: row.balance,
    invested: row.invested,
    monthlyEarnings: row.monthly_earnings,
    totalWithdrawn: row.total_withdrawn,
    todayEarnings: row.today_earnings,
    createdAt: row.created_at,
  };
}

/* ---------- Seed ---------- */
function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const now = Date.now();
  const day = 86400000;
  const adminHash = bcrypt.hashSync("admin123", 12);
  const userHash = bcrypt.hashSync("demo123", 12);
  const genericHash = bcrypt.hashSync("user123", 12);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, banned, balance, invested,
      monthly_earnings, total_withdrawn, today_earnings, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    ["u-admin", "Administrator", "admin", adminHash, "admin", 0, 152000, 86000, 12400, 38000, 0, now - 15 * day],
    ["u-demo", "Demo User", "demo", userHash, "user", 0, 24800.75, 8400, 1520.75, 3200, 125.5, now - 10 * day],
    ["u-2", "Sarah Kim", "sarah", genericHash, "user", 0, 54000, 21000, 4100, 9000, 210.25, now - 8 * day],
    ["u-3", "Mike Johnson", "mike", genericHash, "user", 0, 12500, 5000, 850, 1500, 42, now - 6 * day],
    ["u-4", "Lisa Adams", "lisa", genericHash, "user", 0, 8900, 3000, 620, 0, 18.75, now - 4 * day],
  ];
  users.forEach((u) => insertUser.run(...u));

  const insertComment = db.prepare(`
    INSERT INTO comments (id, user_id, username, text, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    ["c1", "u-demo", "demo", "Great platform! Withdrawals are super fast and reliable.", "approved", now - 5 * day],
    ["c2", "u-2", "sarah", "Love the new dashboard — it is so clean and easy to read.", "approved", now - 3 * day],
    ["c3", "u-3", "mike", "Waiting on my payout, but support was very helpful.", "pending", now - 1 * day],
    ["c4", "u-4", "lisa", "I highly recommend the Gold package! Consistent returns.", "pending", now - 5 * 3600000],
    ["c5", "u-2", "sarah", "This is a spam test comment that an admin should reject.", "pending", now - 2 * 3600000],
  ].forEach((c) => insertComment.run(...c));

  const insertCode = db.prepare(`
    INSERT INTO redeem_codes (id, code, amount, used_by, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    ["rc1", "GOLD100", 100, null, null, now - 2 * day],
    ["rc2", "BONUS50", 50, "u-demo", now - 1 * day, now - 10 * day],
    ["rc3", "WELCOME25", 25, null, null, now - 7 * day],
    ["rc4", "VIP500", 500, null, null, now - 3600000],
  ].forEach((c) => insertCode.run(...c));

  const insertTicket = db.prepare(`
    INSERT INTO tickets (id, user_id, username, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    ["t1", "u-demo", "demo", "Withdrawal delay", "My withdrawal has been pending for 3 days. Can you check?", "open", now - 2 * day],
    ["t2", "u-3", "mike", "Redeem code not working", "The code BONUS50 says it has already been used.", "open", now - 1 * day],
    ["t3", "u-4", "lisa", "Account verification", "How do I verify my identity to increase limits?", "resolved", now - 4 * day],
  ].forEach((t) => insertTicket.run(...t));

  const insertInv = db.prepare(`
    INSERT INTO investments (id, username, amount, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    ["i1", "demo", 2000, "Silver", "active", now - 10 * day],
    ["i2", "demo", 6400, "Gold", "active", now - 5 * day],
    ["i3", "sarah", 15000, "Platinum", "active", now - 12 * day],
    ["i4", "mike", 5000, "Gold", "matured", now - 20 * day],
  ].forEach((i) => insertInv.run(...i));

  const insertWd = db.prepare(`
    INSERT INTO withdrawals (id, username, amount, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `);
  [
    ["w1", "demo", 1200, "Bank Transfer", "completed", now - 8 * day],
    ["w2", "demo", 2000, "M-Pesa", "processing", now - 2 * day],
    ["w3", "sarah", 5000, "Bank Transfer", "completed", now - 6 * day],
  ].forEach((w) => insertWd.run(...w));

  console.log("Database seeded with demo data.");
}

seedIfEmpty();

/* ---------- Express ---------- */
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(express.static(ROOT, { index: "index.html" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts. Please try again later." },
});

function sanitize(str, max = 500) {
  return String(str ?? "").trim().slice(0, max);
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub));
    if (!user || user.banned) return res.status(401).json({ error: "Session invalid or account deactivated." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/* ---------- Auth routes ---------- */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: "api" });
});

app.post("/api/auth/register", authLimiter, (req, res) => {
  const name = sanitize(req.body.name, 80);
  const username = sanitize(req.body.username, 24);
  const password = String(req.body.password || "");

  if (name.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters." });
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3–24 characters (letters, numbers, underscore)." });
  }
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (existing) return res.status(409).json({ error: "That username is already taken. Please choose another." });

  const id = uid();
  const hash = bcrypt.hashSync(password, 12);
  try {
    db.prepare(`
      INSERT INTO users (id, name, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'user', ?)
    `).run(id, name, username, hash, Date.now());
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That username is already taken. Please choose another." });
    }
    throw err;
  }

  setAuthCookie(res, id);
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
  res.status(201).json({ user });
});

app.post("/api/auth/login", authLimiter, (req, res) => {
  const username = sanitize(req.body.username, 24);
  const password = String(req.body.password || "");

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: "Invalid username or password." });
  }

  const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  if (row.banned) {
    return res.status(403).json({ error: "This account has been deactivated. Contact support." });
  }

  setAuthCookie(res, row.id);
  res.json({ user: rowToUser(row) });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/auth/check-username", (req, res) => {
  const username = sanitize(req.query.username, 24);
  if (!username || username.length < 3) return res.json({ available: false });
  const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  res.json({ available: !existing });
});

/* ---------- User data ---------- */
app.get("/api/user/redemptions", authMiddleware, (req, res) => {
  const codes = db.prepare(`
    SELECT code, amount, used_at FROM redeem_codes WHERE used_by = ? ORDER BY used_at DESC
  `).all(req.user.id);
  res.json({ redemptions: codes.map((c) => ({ code: c.code, amount: c.amount, usedAt: c.used_at })) });
});

app.post("/api/user/redeem", authMiddleware, (req, res) => {
  const code = sanitize(req.body.code, 20).toUpperCase();
  if (!code) return res.status(400).json({ error: "Please enter a redeem code." });

  const redeem = db.transaction(() => {
    const row = db.prepare("SELECT * FROM redeem_codes WHERE code = ? COLLATE NOCASE").get(code);
    if (!row) return { error: "Invalid redeem code.", status: 404 };
    if (row.used_by) return { error: "This code has already been used.", status: 400 };

    db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE id = ?").run(
      req.user.id, Date.now(), row.id
    );
    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(row.amount, req.user.id);
    return { amount: row.amount };
  })();

  if (redeem.error) return res.status(redeem.status).json({ error: redeem.error });

  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id));
  res.json({ user, amount: redeem.amount });
});

/* ---------- Comments ---------- */
app.get("/api/comments", authMiddleware, (req, res) => {
  const approved = db.prepare(`
    SELECT id, username, text, created_at AS date, status FROM comments
    WHERE status = 'approved' ORDER BY created_at DESC
  `).all();
  const mine = db.prepare(`
    SELECT id, username, text, created_at AS date, status FROM comments
    WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ approved, mine });
});

app.post("/api/comments", authMiddleware, (req, res) => {
  const text = sanitize(req.body.text, 500);
  if (text.length < 2) return res.status(400).json({ error: "Please enter a comment." });

  const id = uid();
  db.prepare(`
    INSERT INTO comments (id, user_id, username, text, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, req.user.id, req.user.username, text, Date.now());

  res.status(201).json({ ok: true });
});

/* ---------- Tickets ---------- */
app.get("/api/tickets", authMiddleware, (req, res) => {
  const tickets = db.prepare(`
    SELECT id, subject, message, status, created_at AS createdAt FROM tickets
    WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ tickets });
});

app.post("/api/tickets", authMiddleware, (req, res) => {
  const subject = sanitize(req.body.subject, 80);
  const message = sanitize(req.body.message, 1000);
  if (!subject || !message) return res.status(400).json({ error: "Please fill in both subject and message." });

  const id = uid();
  db.prepare(`
    INSERT INTO tickets (id, user_id, username, subject, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `).run(id, req.user.id, req.user.username, subject, message, Date.now());

  res.status(201).json({ ok: true });
});

app.post("/api/contact", authMiddleware, (req, res) => {
  const subject = sanitize(req.body.subject, 80) || "General inquiry";
  const message = sanitize(req.body.message, 1000);
  if (!message) return res.status(400).json({ error: "Please enter your message." });

  const id = uid();
  db.prepare(`
    INSERT INTO tickets (id, user_id, username, subject, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'open', ?)
  `).run(id, req.user.id, req.user.username, `[Contact] ${subject}`, message, Date.now());

  res.status(201).json({ ok: true });
});

/* ---------- Admin ---------- */
app.get("/api/admin/stats", authMiddleware, adminMiddleware, (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const active = db.prepare("SELECT COUNT(*) AS c FROM users WHERE banned = 0").get().c;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending'").get().c;
  const openTickets = db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE status = 'open'").get().c;
  const codes = db.prepare("SELECT COUNT(*) AS c FROM redeem_codes").get().c;
  const totals = db.prepare(`
    SELECT COALESCE(SUM(balance),0) AS balance, COALESCE(SUM(invested),0) AS invested,
           COALESCE(SUM(total_withdrawn),0) AS withdrawn FROM users
  `).get();
  res.json({
    users, active, banned: users - active, pending, openTickets, codes,
    totalBalance: totals.balance, totalInvested: totals.invested, totalWithdrawn: totals.withdrawn,
  });
});

app.get("/api/admin/users", authMiddleware, adminMiddleware, (req, res) => {
  const q = sanitize(req.query.q, 50).toLowerCase();
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT * FROM users WHERE LOWER(username) LIKE ? OR LOWER(name) LIKE ?
      ORDER BY created_at DESC
    `).all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  }
  res.json({ users: rows.map(rowToUser) });
});

app.patch("/api/admin/users/:id/ban", authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const banned = !!req.body.banned;
  if (id === req.user.id) return res.status(400).json({ error: "You cannot ban your own account." });
  const row = db.prepare("SELECT role FROM users WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "User not found." });
  db.prepare("UPDATE users SET banned = ? WHERE id = ?").run(banned ? 1 : 0, id);
  res.json({ ok: true });
});

app.get("/api/admin/comments", authMiddleware, adminMiddleware, (_req, res) => {
  const comments = db.prepare(`
    SELECT id, user_id AS userId, username, text, status, created_at AS date FROM comments ORDER BY created_at DESC
  `).all();
  res.json({ comments });
});

app.patch("/api/admin/comments/:id", authMiddleware, adminMiddleware, (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  db.prepare("UPDATE comments SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/admin/comments/:id", authMiddleware, adminMiddleware, (req, res) => {
  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/tickets", authMiddleware, adminMiddleware, (_req, res) => {
  const tickets = db.prepare(`
    SELECT id, username, subject, message, status, created_at AS createdAt FROM tickets ORDER BY created_at DESC
  `).all();
  res.json({ tickets });
});

app.patch("/api/admin/tickets/:id/resolve", authMiddleware, adminMiddleware, (req, res) => {
  db.prepare("UPDATE tickets SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/codes", authMiddleware, adminMiddleware, (_req, res) => {
  const codes = db.prepare(`
    SELECT rc.*, u.username AS redeemed_by_username FROM redeem_codes rc
    LEFT JOIN users u ON u.id = rc.used_by ORDER BY rc.created_at DESC
  `).all();
  res.json({
    codes: codes.map((c) => ({
      id: c.id, code: c.code, amount: c.amount,
      usedBy: c.used_by, usedAt: c.used_at, createdAt: c.created_at,
      redeemedByUsername: c.redeemed_by_username,
    })),
  });
});

app.post("/api/admin/codes", authMiddleware, adminMiddleware, (req, res) => {
  const code = sanitize(req.body.code, 20).toUpperCase();
  const amount = parseFloat(req.body.amount);
  if (!code || !amount || amount <= 0) {
    return res.status(400).json({ error: "Please provide a valid code and amount." });
  }
  try {
    db.prepare(`
      INSERT INTO redeem_codes (id, code, amount, created_at) VALUES (?, ?, ?, ?)
    `).run(uid(), code, amount, Date.now());
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "That code already exists." });
    }
    throw err;
  }
  res.status(201).json({ ok: true });
});

app.delete("/api/admin/codes/:id", authMiddleware, adminMiddleware, (req, res) => {
  db.prepare("DELETE FROM redeem_codes WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/investments", authMiddleware, adminMiddleware, (_req, res) => {
  const investments = db.prepare(`
    SELECT id, username, amount, plan, status, created_at AS date FROM investments ORDER BY created_at DESC
  `).all();
  res.json({ investments });
});

app.get("/api/admin/withdrawals", authMiddleware, adminMiddleware, (_req, res) => {
  const withdrawals = db.prepare(`
    SELECT id, username, amount, method, status, created_at AS date FROM withdrawals ORDER BY created_at DESC
  `).all();
  res.json({ withdrawals });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Gold Mine running at http://localhost:${PORT}`);
});
