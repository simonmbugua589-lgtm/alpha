/* ============================================================
   GOLD MINE — Application Logic
   API mode (Express + SQLite) with localStorage fallback
   ============================================================ */

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const toggleButtons = document.querySelectorAll(".toggle-btn");
const navButtons = document.querySelectorAll(".nav-btn");
const dashboardContent = document.getElementById("dashboardContent");
const welcomeTitle = document.getElementById("welcomeTitle");
const currentUserLabel = document.getElementById("currentUserLabel");
const logoutBtn = document.getElementById("logoutBtn");
const themeToggle = document.getElementById("themeToggle");
const authThemeToggle = document.getElementById("authThemeToggle");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const toastContainer = document.getElementById("toastContainer");
const modalOverlay = document.getElementById("modalOverlay");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const goLogin = document.getElementById("goLogin");
const goSignup = document.getElementById("goSignup");

let currentSection = "home";
let currentAdminTab = "overview";
let useApi = false;
let currentUser = null;
let cachedRedemptions = [];

const KEYS = {
  users: "goldMineUsers",
  current: "goldMineCurrentUser",
  comments: "goldMineComments",
  codes: "goldMineCodes",
  tickets: "goldMineTickets",
  investments: "goldMineInvestments",
  withdrawals: "goldMineWithdrawals",
  theme: "goldMineTheme",
};

/* ---------------- API Layer ---------------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function detectApi() {
  if (location.protocol === "file:") {
    useApi = false;
    return false;
  }
  try {
    const res = await fetch("/api/health", { credentials: "include" });
    useApi = res.ok;
    return useApi;
  } catch {
    useApi = false;
    return false;
  }
}

/* ---------------- localStorage fallback ---------------- */
function load(key, fallback) {
  try {
    const val = JSON.parse(localStorage.getItem(key));
    return val ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

const getUsers = () => load(KEYS.users, []);
const saveUsers = (v) => save(KEYS.users, v);
const getComments = () => load(KEYS.comments, []);
const saveComments = (v) => save(KEYS.comments, v);
const getRedeemCodes = () => load(KEYS.codes, []);
const saveRedeemCodes = (v) => save(KEYS.codes, v);
const getTickets = () => load(KEYS.tickets, []);
const saveTickets = (v) => save(KEYS.tickets, v);
const getInvestments = () => load(KEYS.investments, []);
const getWithdrawals = () => load(KEYS.withdrawals, []);

function setCurrentUserLocal(user) {
  currentUser = user;
  if (user) localStorage.setItem(KEYS.current, JSON.stringify(user));
  else localStorage.removeItem(KEYS.current);
}

function getCurrentUserLocal() {
  if (currentUser) return currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem(KEYS.current));
  } catch {
    currentUser = null;
  }
  return currentUser;
}

function getCurrentUser() {
  return currentUser || getCurrentUserLocal();
}

/* ---------------- Utilities ---------------- */
function uid() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function esc(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(str ?? "").replace(/[&<>"']/g, (c) => map[c] || c);
}

function fmtMoney(n) {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function genSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bytesToBase64(arr);
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  el.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span></span>`;
  el.querySelector("span:last-child").textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("removing");
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

function openModal(html) {
  modalBody.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBody.innerHTML = "";
}

function setBtnLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span>${label || "Please wait…"}`;
  } else {
    btn.textContent = btn.dataset.origText || label || "Submit";
  }
}

function showFormError(form, msg) {
  let el = form.querySelector(".form-error");
  if (!el) {
    el = document.createElement("div");
    el.className = "form-error";
    el.setAttribute("role", "alert");
    form.insertBefore(el, form.querySelector("button[type=submit]"));
  }
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

/* ---------------- Password hashing (localStorage mode) ---------------- */
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = (sha256.h = sha256.h || []);
  const k = (sha256.k = sha256.k || []);
  let primeCounter = k.length;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return "";
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

function fallbackHash(str) {
  let h = str;
  for (let i = 0; i < 500; i++) h = sha256(h);
  return h;
}

async function hashPassword(password, salt) {
  if (window.crypto && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        256
      );
      return bytesToBase64(new Uint8Array(bits));
    } catch {
      /* fallback below */
    }
  }
  return fallbackHash(salt + ":" + password);
}

/* ---------------- Seed (localStorage mode) ---------------- */
async function ensureSeedData() {
  if (useApi || getUsers().length) return;
  const now = Date.now();
  const day = 86400000;

  async function makeUser(id, name, username, password, role, extra = {}) {
    const salt = genSalt();
    const hash = await hashPassword(password, salt);
    return { id, name, username, salt, hash, role, banned: false, createdAt: now - 10 * day, todayEarnings: 0, balance: 0, invested: 0, monthlyEarnings: 0, totalWithdrawn: 0, ...extra };
  }

  saveUsers([
    await makeUser("u-admin", "Administrator", "admin", "admin123", "admin", { balance: 152000, invested: 86000, monthlyEarnings: 12400, totalWithdrawn: 38000 }),
    await makeUser("u-demo", "Demo User", "demo", "demo123", "user", { balance: 24800.75, invested: 8400, monthlyEarnings: 1520.75, totalWithdrawn: 3200, todayEarnings: 125.5 }),
    await makeUser("u-2", "Sarah Kim", "sarah", "user123", "user", { balance: 54000, invested: 21000, monthlyEarnings: 4100, totalWithdrawn: 9000, todayEarnings: 210.25 }),
    await makeUser("u-3", "Mike Johnson", "mike", "user123", "user", { balance: 12500, invested: 5000, monthlyEarnings: 850, totalWithdrawn: 1500, todayEarnings: 42 }),
    await makeUser("u-4", "Lisa Adams", "lisa", "user123", "user", { balance: 8900, invested: 3000, monthlyEarnings: 620, totalWithdrawn: 0, todayEarnings: 18.75 }),
  ]);

  saveComments([
    { id: "c1", userId: "u-demo", username: "demo", text: "Great platform! Withdrawals are super fast and reliable.", date: now - 5 * day, status: "approved" },
    { id: "c2", userId: "u-2", username: "sarah", text: "Love the new dashboard — it is so clean and easy to read.", date: now - 3 * day, status: "approved" },
    { id: "c3", userId: "u-3", username: "mike", text: "Waiting on my payout, but support was very helpful.", date: now - 1 * day, status: "pending" },
  ]);

  saveRedeemCodes([
    { id: "rc1", code: "GOLD100", amount: 100, usedBy: null, usedAt: null, createdAt: now - 2 * day },
    { id: "rc2", code: "BONUS50", amount: 50, usedBy: "u-demo", usedAt: now - 1 * day, createdAt: now - 10 * day },
    { id: "rc3", code: "WELCOME25", amount: 25, usedBy: null, usedAt: null, createdAt: now - 7 * day },
    { id: "rc4", code: "VIP500", amount: 500, usedBy: null, usedAt: null, createdAt: now - 3600000 },
  ]);

  saveTickets([
    { id: "t1", userId: "u-demo", username: "demo", subject: "Withdrawal delay", message: "My withdrawal has been pending for 3 days.", status: "open", createdAt: now - 2 * day },
    { id: "t2", userId: "u-3", username: "mike", subject: "Redeem code not working", message: "The code BONUS50 says it has already been used.", status: "open", createdAt: now - 1 * day },
  ]);
}

/* ---------------- Auth ---------------- */
function switchAuthForm(target) {
  toggleButtons.forEach((b) => b.classList.toggle("active", b.dataset.form === target));
  loginForm.classList.toggle("active", target === "login");
  signupForm.classList.toggle("active", target === "signup");
  showFormError(loginForm, "");
  showFormError(signupForm, "");
}

function setInvalid(input, invalid) {
  input.classList.toggle("invalid", invalid);
  const small = input.closest("label")?.querySelector(".field-error");
  if (small) small.classList.toggle("hidden", !invalid);
  return !invalid;
}

async function refreshCurrentUser() {
  if (useApi) {
    try {
      const { user } = await api("/api/auth/me");
      currentUser = user;
      return user;
    } catch {
      currentUser = null;
      return null;
    }
  }
  const stored = getCurrentUserLocal();
  if (stored) {
    const fresh = getUsers().find((u) => u.id === stored.id);
    if (fresh && !fresh.banned) {
      currentUser = fresh;
      setCurrentUserLocal(fresh);
      return fresh;
    }
  }
  currentUser = null;
  return null;
}

async function handleLogin(e) {
  e.preventDefault();
  const uInput = document.getElementById("loginUsername");
  const pInput = document.getElementById("loginPassword");
  const btn = loginForm.querySelector('button[type="submit"]');
  const username = uInput.value.trim();
  const password = pInput.value;

  showFormError(loginForm, "");
  let ok = true;
  ok = setInvalid(uInput, username.length < 3) && ok;
  ok = setInvalid(pInput, password.length < 6) && ok;
  if (!ok) return;

  setBtnLoading(btn, true, "Signing in…");
  try {
    if (useApi) {
      const { user } = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      currentUser = user;
      toast(`Welcome back, @${user.username}!`, "success");
      showDashboard(user);
    } else {
      const user = getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        showFormError(loginForm, "Invalid username or password.");
        toast("Invalid username or password.", "error");
        return;
      }
      if (user.banned) {
        showFormError(loginForm, "This account has been deactivated. Contact support.");
        toast("This account has been deactivated. Contact support.", "error");
        return;
      }
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.hash) {
        showFormError(loginForm, "Invalid username or password.");
        toast("Invalid username or password.", "error");
        return;
      }
      setCurrentUserLocal(user);
      toast(`Welcome back, @${user.username}!`, "success");
      showDashboard(user);
    }
  } catch (err) {
    showFormError(loginForm, err.message);
    toast(err.message, "error");
  } finally {
    setBtnLoading(btn, false, "Sign in");
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const n = document.getElementById("signupName");
  const u = document.getElementById("signupUsername");
  const p = document.getElementById("signupPassword");
  const c = document.getElementById("signupConfirm");
  const btn = signupForm.querySelector('button[type="submit"]');
  const name = n.value.trim();
  const username = u.value.trim();
  const password = p.value;
  const confirm = c.value;

  showFormError(signupForm, "");
  let ok = true;
  ok = setInvalid(n, name.length < 2) && ok;
  ok = setInvalid(u, !/^[A-Za-z0-9_]{3,24}$/.test(username)) && ok;
  ok = setInvalid(p, password.length < 6) && ok;
  ok = setInvalid(c, confirm !== password || confirm.length < 6) && ok;
  if (!ok) return;

  setBtnLoading(btn, true, "Creating account…");
  try {
    if (useApi) {
      const { user } = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, username, password }),
      });
      currentUser = user;
      toast("Account created successfully! Welcome aboard.", "success");
      showDashboard(user);
    } else {
      if (getUsers().some((x) => x.username.toLowerCase() === username.toLowerCase())) {
        setInvalid(u, true);
        showFormError(signupForm, "That username is already taken. Please choose another.");
        toast("That username is already taken. Please choose another.", "error");
        return;
      }
      const salt = genSalt();
      const hash = await hashPassword(password, salt);
      const newUser = {
        id: uid(), name, username, salt, hash, role: "user", banned: false,
        createdAt: Date.now(), todayEarnings: 0, balance: 0, invested: 0, monthlyEarnings: 0, totalWithdrawn: 0,
      };
      const users = getUsers();
      users.push(newUser);
      saveUsers(users);
      setCurrentUserLocal(newUser);
      toast("Account created successfully! Welcome aboard.", "success");
      showDashboard(newUser);
    }
  } catch (err) {
    showFormError(signupForm, err.message);
    toast(err.message, "error");
  } finally {
    setBtnLoading(btn, false, "Create account");
  }
}

async function logout() {
  if (useApi) {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  }
  currentUser = null;
  setCurrentUserLocal(null);
  showAuth();
  switchAuthForm("login");
  toast("You have been logged out.", "info");
}

let usernameCheckTimer;
async function checkUsernameAvailability(username) {
  const hint = document.getElementById("usernameHint");
  if (!hint) return;
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    hint.className = "field-hint hidden";
    return;
  }
  if (useApi) {
    try {
      const { available } = await api(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      hint.className = "field-hint " + (available ? "available" : "taken");
      hint.textContent = available ? "✓ Username is available" : "✗ Username is already taken";
      hint.classList.remove("hidden");
    } catch { hint.classList.add("hidden"); }
  } else {
    const taken = getUsers().some((x) => x.username.toLowerCase() === username.toLowerCase());
    hint.className = "field-hint " + (taken ? "taken" : "available");
    hint.textContent = taken ? "✗ Username is already taken" : "✓ Username is available";
    hint.classList.remove("hidden");
  }
}

/* ---------------- View helpers ---------------- */
function statCard(label, value, icon, colorClass = "", valueClass = "") {
  return `
    <div class="stat-card">
      <div class="stat-head">
        <span class="stat-label">${esc(label)}</span>
        <span class="stat-icon ${colorClass}">${icon}</span>
      </div>
      <div class="stat-value ${valueClass}">${value}</div>
    </div>`;
}

function commentItem(c) {
  return `
    <div class="comment-item">
      <div class="comment-head">
        <span class="comment-user">👤 ${esc(c.username)}</span>
        <span class="comment-date">${fmtDate(c.date)}</span>
      </div>
      <p class="comment-text">${esc(c.text)}</p>
    </div>`;
}

/* ---------------- HOME ---------------- */
async function renderHome(user) {
  let redemptions = [];
  if (useApi) {
    try {
      const data = await api("/api/user/redemptions");
      redemptions = data.redemptions || [];
      cachedRedemptions = redemptions;
    } catch { /* use cache */ redemptions = cachedRedemptions; }
  } else {
    redemptions = getRedeemCodes().filter((c) => c.usedBy === user.id);
  }

  dashboardContent.innerHTML = `
    <div class="section-header">
      <div>
        <h3>📊 Dashboard Overview</h3>
        <p class="section-desc">Your financial snapshot at a glance.</p>
      </div>
    </div>
    <div class="cards-grid">
      ${statCard("Today's Earnings", fmtMoney(user.todayEarnings), "💰", "gold", "success")}
      ${statCard("Total Cash Balance", fmtMoney(user.balance), "💵", "blue")}
      ${statCard("Total Invested", fmtMoney(user.invested), "📈", "purple")}
      ${statCard("Monthly Earnings", fmtMoney(user.monthlyEarnings), "📅", "green")}
      ${statCard("Total Withdrawn", fmtMoney(user.totalWithdrawn), "🏦", "red")}
    </div>
    <div class="redeem-box">
      <h3>🎁 Redeem Code</h3>
      <p class="section-desc">Enter a valid redeem code to credit your cash balance instantly.</p>
      <div class="redeem-input-row">
        <input type="text" id="redeemInput" placeholder="e.g. GOLD100" maxlength="20" autocomplete="off" />
        <button class="btn btn-gold" data-action="redeem-code">Redeem</button>
      </div>
      <div class="redeem-history">
        <h4>Redemption history</h4>
        ${redemptions.length
          ? `<div class="list">${redemptions.map((r) => `
            <div class="list-item">
              <span class="muted">${esc(r.code)}</span>
              <strong class="value success">+${fmtMoney(r.amount)}</strong>
            </div>`).join("")}</div>`
          : `<div class="empty-state"><span class="icon">🎟️</span>No codes redeemed yet.</div>`}
      </div>
    </div>`;
}

async function handleRedeem() {
  const user = getCurrentUser();
  if (!user) return;
  const input = document.getElementById("redeemInput");
  const code = (input.value || "").trim().toUpperCase();
  if (!code) { toast("Please enter a redeem code.", "error"); return; }

  try {
    if (useApi) {
      const { user: updated, amount } = await api("/api/user/redeem", { method: "POST", body: JSON.stringify({ code }) });
      currentUser = updated;
      toast(`Redeemed ${fmtMoney(amount)} successfully!`, "success");
      renderHome(updated);
    } else {
      const codes = getRedeemCodes();
      const found = codes.find((c) => c.code.toUpperCase() === code);
      if (!found) { toast("Invalid redeem code.", "error"); return; }
      if (found.usedBy) { toast("This code has already been used.", "error"); return; }
      found.usedBy = user.id;
      found.usedAt = Date.now();
      const users = getUsers();
      const u = users.find((x) => x.id === user.id);
      if (u) { u.balance += found.amount; saveUsers(users); setCurrentUserLocal(u); currentUser = u; }
      saveRedeemCodes(codes);
      toast(`Redeemed ${fmtMoney(found.amount)} successfully!`, "success");
      renderHome(u || user);
    }
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------- SUPPORT ---------------- */
const faqItems = () => [
  { q: "How do I withdraw my earnings?", a: "Go to the Home dashboard and use the Withdraw option. Funds are typically processed within 1–3 business days depending on your method." },
  { q: "When do I receive my daily earnings?", a: "Daily earnings are credited automatically to your cash balance every 24 hours based on your active investment package." },
  { q: "What is a redeem code and how do I get one?", a: "Redeem codes are bonus credits distributed via promotions, events, and referrals. Enter a valid code on the Home page to add its value to your balance." },
  { q: "Is my password stored securely?", a: "Yes. Passwords are hashed with bcrypt (server) or PBKDF2 (offline mode) and are never stored in plain text." },
  { q: "How long does comment approval take?", a: "Comments are reviewed by our moderation team, usually within 24 hours. Approved comments appear publicly on the Comments page." },
];

async function renderSupport(user) {
  let myTickets = [];
  if (useApi) {
    try {
      const data = await api("/api/tickets");
      myTickets = data.tickets || [];
    } catch { /* empty */ }
  } else {
    myTickets = getTickets().filter((t) => t.userId === user.id);
  }

  dashboardContent.innerHTML = `
    <div class="section-header">
      <div>
        <h3>🎧 Support Center</h3>
        <p class="section-desc">We are here to help — reach out any time.</p>
      </div>
    </div>
    <div class="cards-grid">
      <div class="card">
        <h4>✉️ Live Support</h4>
        <div class="list">
          <div class="list-item"><span class="muted">Email</span><strong>support@goldmine.app</strong></div>
          <div class="list-item"><span class="muted">Phone</span><strong>+1 (800) 555-0199</strong></div>
          <div class="list-item"><span class="muted">Hours</span><strong>24/7 Support</strong></div>
          <div class="list-item"><span class="muted">Live Chat</span><strong class="user-active">● Online now</strong></div>
        </div>
      </div>
      <div class="card">
        <h4>📨 Contact Support</h4>
        <form data-action="contact-submit" style="display:grid;gap:12px">
          <label>Subject
            <input type="text" name="contactSubject" placeholder="How can we help?" maxlength="80" />
          </label>
          <label>Message
            <textarea name="contactMessage" required rows="4" placeholder="Describe your question..." maxlength="1000"></textarea>
          </label>
          <button class="btn btn-gold" type="submit">Send Message</button>
        </form>
      </div>
      <div class="card">
        <h4>🎫 Submit a Ticket</h4>
        <form data-action="ticket-submit" style="display:grid;gap:12px">
          <label>Subject
            <input type="text" name="ticketSubject" required placeholder="Brief summary" maxlength="80" />
          </label>
          <label>Message
            <textarea name="ticketMessage" required rows="4" placeholder="Describe your issue..." maxlength="1000"></textarea>
          </label>
          <button class="btn btn-gold" type="submit">Submit Ticket</button>
        </form>
      </div>
    </div>
    <div class="card">
      <h4>❓ Frequently Asked Questions</h4>
      <div class="list">${faqItems().map((f) => `
        <div class="faq-item">
          <button class="faq-q" data-action="faq-toggle">${esc(f.q)} <span class="chevron">▼</span></button>
          <div class="faq-a">${esc(f.a)}</div>
        </div>`).join("")}</div>
    </div>
    <div class="card">
      <h4>🎫 Your Tickets</h4>
      ${myTickets.length
        ? `<div class="list">${myTickets.map((t) => `
          <div class="list-item">
            <div><strong>${esc(t.subject)}</strong><br /><span class="muted">${fmtDate(t.createdAt)}</span></div>
            <span class="status-badge status-${esc(t.status)}">${esc(t.status)}</span>
          </div>`).join("")}</div>`
        : `<div class="empty-state"><span class="icon">📭</span>No tickets yet — submit one above.</div>`}
    </div>`;
}

async function submitTicket(form) {
  const user = getCurrentUser();
  const subject = form.ticketSubject.value.trim();
  const message = form.ticketMessage.value.trim();
  if (!subject || !message) { toast("Please fill in both subject and message.", "error"); return; }

  try {
    if (useApi) {
      await api("/api/tickets", { method: "POST", body: JSON.stringify({ subject, message }) });
    } else {
      const tickets = getTickets();
      tickets.push({ id: uid(), userId: user.id, username: user.username, subject, message, status: "open", createdAt: Date.now() });
      saveTickets(tickets);
    }
    toast("Ticket submitted! Our team will respond soon.", "success");
    renderSupport(user);
  } catch (err) {
    toast(err.message, "error");
  }
}

async function submitContact(form) {
  const user = getCurrentUser();
  const subject = form.contactSubject.value.trim();
  const message = form.contactMessage.value.trim();
  if (!message) { toast("Please enter your message.", "error"); return; }

  try {
    if (useApi) {
      await api("/api/contact", { method: "POST", body: JSON.stringify({ subject, message }) });
    } else {
      const tickets = getTickets();
      tickets.push({ id: uid(), userId: user.id, username: user.username, subject: subject || "General inquiry", message, status: "open", createdAt: Date.now() });
      saveTickets(tickets);
    }
    toast("Message sent! Support will get back to you shortly.", "success");
    form.reset();
    renderSupport(user);
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------- DOWNLOAD ---------------- */
function renderDownload() {
  dashboardContent.innerHTML = `
    <div class="download-hero">
      <div class="big-icon">📲</div>
      <h3>Take Gold Mine Everywhere</h3>
      <p class="section-desc">Get the Gold Mine app on your favorite device and manage your earnings on the go.</p>
    </div>
    <div class="platform-cards">
      <div class="platform-card">
        <span class="platform-icon">🤖</span>
        <h4>Android</h4>
        <p class="section-desc">Download the latest APK directly and install in seconds.</p>
        <button class="btn btn-gold" data-action="download-apk">⬇️ Download APK</button>
      </div>
      <div class="platform-card">
        <span class="platform-icon">🍎</span>
        <h4>iOS</h4>
        <p class="section-desc">Coming soon to the App Store.</p>
        <button class="btn" disabled>🚧 Coming Soon</button>
      </div>
    </div>
    <div class="card">
      <h4>📖 Installation Instructions</h4>
      <div class="steps">
        <div class="step"><span class="step-num">1</span><div class="step-body"><strong>Download the APK</strong><p>Tap the Download APK button above. The file is saved to your Downloads folder.</p></div></div>
        <div class="step"><span class="step-num">2</span><div class="step-body"><strong>Allow unknown sources</strong><p>On Android, go to Settings → Security and enable "Install unknown apps" for your browser.</p></div></div>
        <div class="step"><span class="step-num">3</span><div class="step-body"><strong>Install the app</strong><p>Open GoldMine.apk from Downloads and tap Install.</p></div></div>
        <div class="step"><span class="step-num">4</span><div class="step-body"><strong>Sign in</strong><p>Launch Gold Mine and log in with your username and password to continue.</p></div></div>
      </div>
    </div>`;
}

function handleDownloadApk() {
  const content = "Gold Mine Android App\nVersion: 1.0.0\n\nThis is a placeholder APK. In production, replace with a signed Android installer.";
  const blob = new Blob([content], { type: "application/vnd.android.package-archive" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "GoldMine.apk";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("GoldMine.apk download started.", "success");
}

/* ---------------- COMMENTS ---------------- */
async function renderComments(user) {
  let approved = [], mine = [];
  if (useApi) {
    try {
      const data = await api("/api/comments");
      approved = data.approved || [];
      mine = data.mine || [];
    } catch { /* empty */ }
  } else {
    approved = getComments().filter((c) => c.status === "approved");
    mine = getComments().filter((c) => c.userId === user.id);
  }

  dashboardContent.innerHTML = `
    <div class="section-header">
      <div>
        <h3>💬 Recommendations & Comments</h3>
        <p class="section-desc">Share your experience. Comments appear publicly once approved.</p>
      </div>
    </div>
    <div class="cards-grid">
      <div class="card">
        <h4>✍️ Share your recommendation</h4>
        <form data-action="comment-submit" style="display:grid;gap:12px">
          <textarea name="commentText" required rows="4" maxlength="500" placeholder="Write your recommendation or comment..."></textarea>
          <small class="muted">Your comment will be reviewed by an administrator before it appears publicly.</small>
          <button class="btn btn-gold" type="submit">Submit Comment</button>
        </form>
      </div>
      <div class="card">
        <h4>🗂 Your submissions</h4>
        ${mine.length
          ? `<div class="list">${mine.map((c) => `
            <div class="list-item">
              <div><strong>${esc(c.text.slice(0, 60))}${c.text.length > 60 ? "…" : ""}</strong><br /><span class="muted">${fmtDate(c.date)}</span></div>
              <span class="status-badge status-${esc(c.status)}">${esc(c.status)}</span>
            </div>`).join("")}</div>`
          : `<div class="empty-state"><span class="icon">🗒️</span>You have not submitted any comments yet.</div>`}
      </div>
    </div>
    <div class="card">
      <h4>🌐 Community Recommendations</h4>
      ${approved.length
        ? `<div class="list">${approved.map(commentItem).join("")}</div>`
        : `<div class="empty-state"><span class="icon">💤</span>No approved comments yet. Be the first to share!</div>`}
    </div>`;
}

async function submitComment(form) {
  const user = getCurrentUser();
  const text = form.commentText.value.trim();
  if (text.length < 2) { toast("Please enter a comment.", "error"); return; }

  try {
    if (useApi) {
      await api("/api/comments", { method: "POST", body: JSON.stringify({ text }) });
    } else {
      const comments = getComments();
      comments.push({ id: uid(), userId: user.id, username: user.username, text, date: Date.now(), status: "pending" });
      saveComments(comments);
    }
    toast("Comment submitted! It will appear once approved.", "success");
    renderComments(user);
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------- ADMIN ---------------- */
const adminRenderers = {
  overview: adminOverview,
  users: adminUsers,
  comments: adminComments,
  tickets: adminTickets,
  codes: adminCodes,
  investments: adminInvestments,
  withdrawals: adminWithdrawals,
};

const tabLabels = {
  overview: "📊 Overview", users: "👥 Users", comments: "💬 Comments",
  tickets: "🎫 Tickets", codes: "🎟️ Codes", investments: "📈 Investments", withdrawals: "🏦 Withdrawals",
};

async function renderAdmin(user) {
  currentAdminTab = currentAdminTab || "overview";
  dashboardContent.innerHTML = `
    <div class="section-header">
      <div><h3>🛠 Admin Panel</h3><p class="section-desc">Manage users, content, redeem codes and support.</p></div>
    </div>
    <div class="tabs">${Object.keys(adminRenderers).map((t) =>
      `<button class="tab-btn ${t === currentAdminTab ? "active" : ""}" data-action="admin-tab" data-tab="${t}">${tabLabels[t]}</button>`
    ).join("")}</div>
    <div id="adminContent"><div class="empty-state"><span class="icon">⏳</span>Loading…</div></div>`;
  await renderAdminTab();
}

async function renderAdminTab() {
  const content = document.getElementById("adminContent");
  if (content) content.innerHTML = await adminRenderers[currentAdminTab]();
}

async function adminOverview() {
  if (useApi) {
    try {
      const s = await api("/api/admin/stats");
      return `<div class="cards-grid">
        ${statCard("Total Users", String(s.users), "👥", "blue")}
        ${statCard("Active Users", String(s.active), "✅", "green")}
        ${statCard("Banned Users", String(s.banned), "🚫", "red")}
        ${statCard("Pending Comments", String(s.pending), "⏳", "gold")}
        ${statCard("Open Tickets", String(s.openTickets), "🎫", "purple")}
        ${statCard("Redeem Codes", String(s.codes), "🎟️", "gold")}
        ${statCard("Total Balance", fmtMoney(s.totalBalance), "💰", "gold")}
        ${statCard("Total Invested", fmtMoney(s.totalInvested), "📈", "green")}
        ${statCard("Total Withdrawn", fmtMoney(s.totalWithdrawn), "🏦", "red")}
      </div>`;
    } catch { /* fallback */ }
  }
  const users = getUsers();
  const comments = getComments();
  const tickets = getTickets();
  const codes = getRedeemCodes();
  const active = users.filter((u) => !u.banned).length;
  return `<div class="cards-grid">
    ${statCard("Total Users", String(users.length), "👥", "blue")}
    ${statCard("Active Users", String(active), "✅", "green")}
    ${statCard("Banned Users", String(users.length - active), "🚫", "red")}
    ${statCard("Pending Comments", String(comments.filter((c) => c.status === "pending").length), "⏳", "gold")}
    ${statCard("Open Tickets", String(tickets.filter((t) => t.status === "open").length), "🎫", "purple")}
    ${statCard("Redeem Codes", String(codes.length), "🎟️", "gold")}
    ${statCard("Total Balance", fmtMoney(users.reduce((s, u) => s + u.balance, 0)), "💰", "gold")}
    ${statCard("Total Invested", fmtMoney(users.reduce((s, u) => s + u.invested, 0)), "📈", "green")}
    ${statCard("Total Withdrawn", fmtMoney(users.reduce((s, u) => s + u.totalWithdrawn, 0)), "🏦", "red")}
  </div>`;
}

function userRow(u) {
  const current = getCurrentUser();
  const isSelf = current && current.id === u.id;
  const canModerate = !(u.role === "admin" && isSelf);
  return `<tr>
    <td><strong>${esc(u.username)}</strong><br /><span class="muted">${esc(u.name)}</span></td>
    <td><span class="role-badge ${u.role === "admin" ? "role-admin" : "role-user"}">${esc(u.role)}</span></td>
    <td>${fmtMoney(u.balance)}</td>
    <td>${u.banned ? '<span class="user-banned">● Banned</span>' : '<span class="user-active">● Active</span>'}</td>
    <td class="muted">${fmtDate(u.createdAt)}</td>
    <td><div class="btn-row">${canModerate
      ? u.banned
        ? `<button class="btn btn-success btn-sm" data-action="admin-unban-user" data-id="${u.id}">↩ Reinstate</button>`
        : `<button class="btn btn-danger btn-sm" data-action="admin-ban-user" data-id="${u.id}">🚫 Ban</button>`
      : '<span class="muted">—</span>'}</div></td>
  </tr>`;
}

async function adminUsers() {
  let users = getUsers();
  if (useApi) {
    try {
      const data = await api("/api/admin/users");
      users = data.users || [];
    } catch { /* fallback */ }
  }
  return `
    <div class="section-header">
      <div><h3>👥 All Users</h3><p class="section-desc">Search, ban or reinstate accounts.</p></div>
      <input id="adminSearch" class="search-input" placeholder="🔍 Search by username or name..." />
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>User</th><th>Role</th><th>Balance</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody id="adminUsersBody">${users.map(userRow).join("")}</tbody></table>
    </div>`;
}

async function filterAdminUsers(query) {
  const q = (query || "").trim();
  if (useApi) {
    try {
      const data = await api(`/api/admin/users?q=${encodeURIComponent(q)}`);
      const body = document.getElementById("adminUsersBody");
      if (body) body.innerHTML = (data.users || []).map(userRow).join("");
    } catch { /* ignore */ }
    return;
  }
  const filtered = getUsers().filter((u) =>
    !q || u.username.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase())
  );
  const body = document.getElementById("adminUsersBody");
  if (body) body.innerHTML = filtered.map(userRow).join("");
}

function renderCommentList(items) {
  return items.length
    ? `<div class="list">${items.map((c) => `
      <div class="comment-item">
        <div class="comment-head">
          <span class="comment-user">👤 ${esc(c.username)}</span>
          <span class="comment-date">${fmtDate(c.date)}</span>
          <span class="status-badge status-${esc(c.status)}">${esc(c.status)}</span>
        </div>
        <p class="comment-text">${esc(c.text)}</p>
        <div class="btn-row">
          ${c.status !== "approved" ? `<button class="btn btn-success btn-sm" data-action="admin-approve-comment" data-id="${c.id}">✓ Approve</button>` : ""}
          ${c.status !== "rejected" ? `<button class="btn btn-danger btn-sm" data-action="admin-reject-comment" data-id="${c.id}">✕ Reject</button>` : ""}
          <button class="btn btn-sm" data-action="admin-delete-comment" data-id="${c.id}">🗑 Delete</button>
        </div>
      </div>`).join("")}</div>`
    : `<div class="empty-state"><span class="icon">📭</span>Nothing here.</div>`;
}

async function adminComments() {
  let comments = getComments();
  if (useApi) {
    try {
      const data = await api("/api/admin/comments");
      comments = data.comments || [];
    } catch { /* fallback */ }
  }
  const pending = comments.filter((c) => c.status === "pending");
  const approved = comments.filter((c) => c.status === "approved");
  const rejected = comments.filter((c) => c.status === "rejected");
  return `
    <div class="section-header"><div><h3>💬 Comment Moderation</h3><p class="section-desc">Approve, reject or delete user comments.</p></div></div>
    <h4>⏳ Pending (${pending.length})</h4>${renderCommentList(pending)}
    <h4 style="margin-top:18px">✅ Approved (${approved.length})</h4>${renderCommentList(approved)}
    <h4 style="margin-top:18px">🚫 Rejected (${rejected.length})</h4>${renderCommentList(rejected)}`;
}

async function adminTickets() {
  let tickets = getTickets();
  if (useApi) {
    try {
      const data = await api("/api/admin/tickets");
      tickets = data.tickets || [];
    } catch { /* fallback */ }
  }
  return `
    <div class="section-header"><div><h3>🎫 Support Tickets</h3><p class="section-desc">Review and resolve support requests.</p></div></div>
    <div class="table-wrap">
      <table><thead><tr><th>Subject</th><th>User</th><th>Message</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
      <tbody>${tickets.length ? tickets.map((t) => `
        <tr>
          <td><strong>${esc(t.subject)}</strong></td>
          <td>${esc(t.username)}</td>
          <td class="muted" style="max-width:260px">${esc(t.message)}</td>
          <td><span class="status-badge status-${esc(t.status)}">${esc(t.status)}</span></td>
          <td class="muted">${fmtDate(t.createdAt)}</td>
          <td>${t.status !== "resolved" ? `<button class="btn btn-success btn-sm" data-action="admin-resolve-ticket" data-id="${t.id}">✓ Resolve</button>` : "—"}</td>
        </tr>`).join("") : `<tr><td colspan="6"><div class="empty-state">No tickets yet.</div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function adminCodes() {
  let codes = getRedeemCodes();
  const users = getUsers();
  if (useApi) {
    try {
      const data = await api("/api/admin/codes");
      codes = data.codes || [];
    } catch { /* fallback */ }
  }
  return `
    <div class="section-header"><div><h3>🎟️ Redeem Codes</h3><p class="section-desc">Create and manage redeem codes.</p></div></div>
    <form data-action="admin-add-code" class="redeem-input-row" style="margin-bottom:16px">
      <input type="text" name="code" placeholder="Code (e.g. GOLD500)" maxlength="20" required autocomplete="off" />
      <input type="number" name="amount" placeholder="Amount ($)" min="1" step="0.01" required style="max-width:150px" />
      <button class="btn btn-gold" type="submit">＋ Add Code</button>
    </form>
    <div class="table-wrap">
      <table><thead><tr><th>Code</th><th>Amount</th><th>Status</th><th>Redeemed By</th><th>Date</th><th>Action</th></tr></thead>
      <tbody>${codes.length ? codes.map((c) => {
        const usedBy = c.redeemedByUsername || (c.usedBy ? (users.find((u) => u.id === c.usedBy) || {}).username : null);
        return `<tr>
          <td><strong>${esc(c.code)}</strong></td>
          <td><strong class="user-active">${fmtMoney(c.amount)}</strong></td>
          <td>${c.usedBy ? '<span class="user-banned">Used</span>' : '<span class="user-active">Available</span>'}</td>
          <td>${usedBy ? esc(usedBy) : '<span class="muted">—</span>'}</td>
          <td class="muted">${c.usedAt ? fmtDate(c.usedAt) : fmtDate(c.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" data-action="admin-delete-code" data-id="${c.id}">🗑 Delete</button></td>
        </tr>`;
      }).join("") : `<tr><td colspan="6"><div class="empty-state">No redeem codes yet.</div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function adminInvestments() {
  let inv = getInvestments();
  if (useApi) {
    try {
      const data = await api("/api/admin/investments");
      inv = data.investments || [];
    } catch { /* fallback */ }
  }
  return `
    <div class="section-header"><div><h3>📈 Investments</h3><p class="section-desc">All user investments across plans.</p></div></div>
    <div class="table-wrap">
      <table><thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${inv.length ? inv.map((i) => `
        <tr>
          <td><strong>${esc(i.username)}</strong></td>
          <td><span class="role-badge role-user">${esc(i.plan)}</span></td>
          <td><strong class="user-active">${fmtMoney(i.amount)}</strong></td>
          <td><span class="status-badge status-${esc(i.status)}">${esc(i.status)}</span></td>
          <td class="muted">${fmtDate(i.date)}</td>
        </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state">No investments.</div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function adminWithdrawals() {
  let wd = getWithdrawals();
  if (useApi) {
    try {
      const data = await api("/api/admin/withdrawals");
      wd = data.withdrawals || [];
    } catch { /* fallback */ }
  }
  return `
    <div class="section-header"><div><h3>🏦 Withdrawals</h3><p class="section-desc">User withdrawal requests and status.</p></div></div>
    <div class="table-wrap">
      <table><thead><tr><th>User</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${wd.length ? wd.map((w) => `
        <tr>
          <td><strong>${esc(w.username)}</strong></td>
          <td>${esc(w.method)}</td>
          <td><strong class="user-active">${fmtMoney(w.amount)}</strong></td>
          <td><span class="status-badge status-${esc(w.status)}">${esc(w.status)}</span></td>
          <td class="muted">${fmtDate(w.date)}</td>
        </tr>`).join("") : `<tr><td colspan="5"><div class="empty-state">No withdrawals.</div></td></tr>`}
      </tbody></table>
    </div>`;
}

/* ---------- Admin actions ---------- */
async function switchAdminTab(btn) {
  currentAdminTab = btn.dataset.tab;
  document.querySelectorAll('[data-action="admin-tab"]').forEach((b) => b.classList.toggle("active", b === btn));
  await renderAdminTab();
}

async function setCommentStatus(id, status) {
  try {
    if (useApi) await api(`/api/admin/comments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    else {
      const comments = getComments();
      const c = comments.find((x) => x.id === id);
      if (c) { c.status = status; saveComments(comments); }
    }
    toast(status === "approved" ? "Comment approved and published." : "Comment rejected.", "success");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

async function deleteComment(id) {
  try {
    if (useApi) await api(`/api/admin/comments/${id}`, { method: "DELETE" });
    else saveComments(getComments().filter((x) => x.id !== id));
    toast("Comment deleted.", "info");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

async function setUserBan(id, banned) {
  try {
    if (useApi) await api(`/api/admin/users/${id}/ban`, { method: "PATCH", body: JSON.stringify({ banned }) });
    else {
      const users = getUsers();
      const u = users.find((x) => x.id === id);
      if (!u) return;
      if (getCurrentUser()?.id === id) { toast("You cannot ban your own account.", "error"); return; }
      u.banned = banned;
      saveUsers(users);
    }
    toast(banned ? "User has been banned." : "User has been reinstated.", "success");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

async function resolveTicket(id) {
  try {
    if (useApi) await api(`/api/admin/tickets/${id}/resolve`, { method: "PATCH" });
    else {
      const tickets = getTickets();
      const t = tickets.find((x) => x.id === id);
      if (t) { t.status = "resolved"; saveTickets(tickets); }
    }
    toast("Ticket marked as resolved.", "success");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

async function addCode(form) {
  const code = (form.code.value || "").trim().toUpperCase();
  const amount = parseFloat(form.amount.value);
  if (!code || !amount || amount <= 0) { toast("Please provide a valid code and amount.", "error"); return; }
  try {
    if (useApi) await api("/api/admin/codes", { method: "POST", body: JSON.stringify({ code, amount }) });
    else {
      const codes = getRedeemCodes();
      if (codes.some((c) => c.code.toUpperCase() === code)) { toast("That code already exists.", "error"); return; }
      codes.push({ id: uid(), code, amount, usedBy: null, usedAt: null, createdAt: Date.now() });
      saveRedeemCodes(codes);
    }
    toast(`Redeem code ${code} created (${fmtMoney(amount)}).`, "success");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

async function deleteCode(id) {
  try {
    if (useApi) await api(`/api/admin/codes/${id}`, { method: "DELETE" });
    else saveRedeemCodes(getRedeemCodes().filter((c) => c.id !== id));
    toast("Redeem code deleted.", "info");
    renderCurrent();
  } catch (err) { toast(err.message, "error"); }
}

/* ---------------- Navigation ---------------- */
async function renderSection(section, user) {
  navButtons.forEach((b) => b.classList.toggle("active", b.dataset.section === section));
  currentSection = section;
  if (section === "home") await renderHome(user);
  else if (section === "support") await renderSupport(user);
  else if (section === "download") renderDownload();
  else if (section === "comments") await renderComments(user);
  else if (section === "admin") await renderAdmin(user);
  closeSidebar();
}

async function renderCurrent() {
  const user = await refreshCurrentUser();
  if (!user) { logout(); return; }
  if (currentSection === "admin") await renderAdmin(user);
  else await renderSection(currentSection, user);
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.add("hidden");
}

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.remove("hidden");
}

function showDashboard(user) {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", user.role !== "admin"));
  welcomeTitle.textContent = `Welcome, ${user.username}`;
  currentUserLabel.textContent = "@" + user.username;
  renderSection("home", user);
}

function showAuth() {
  authView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
}

/* ---------------- Theme ---------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEYS.theme, theme);
  const icon = theme === "dark" ? "☀️" : "🌙";
  if (themeToggle) themeToggle.textContent = icon;
  if (authThemeToggle) authThemeToggle.textContent = icon;
}

function setupTheme() {
  applyTheme(localStorage.getItem(KEYS.theme) || "dark");
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  toast(next === "light" ? "Light mode enabled." : "Dark mode enabled.", "info");
}

/* ---------------- Events ---------------- */
function handleClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const actions = {
    "redeem-code": handleRedeem,
    "faq-toggle": () => btn.closest(".faq-item")?.classList.toggle("open"),
    "download-apk": handleDownloadApk,
    "admin-tab": () => switchAdminTab(btn),
    "admin-approve-comment": () => setCommentStatus(btn.dataset.id, "approved"),
    "admin-reject-comment": () => setCommentStatus(btn.dataset.id, "rejected"),
    "admin-delete-comment": () => deleteComment(btn.dataset.id),
    "admin-ban-user": () => setUserBan(btn.dataset.id, true),
    "admin-unban-user": () => setUserBan(btn.dataset.id, false),
    "admin-delete-code": () => deleteCode(btn.dataset.id),
    "admin-resolve-ticket": () => resolveTicket(btn.dataset.id),
  };
  if (actions[action]) actions[action]();
}

function handleSubmit(e) {
  const form = e.target.closest("form[data-action]");
  if (!form) return;
  e.preventDefault();
  const action = form.dataset.action;
  if (action === "comment-submit") submitComment(form);
  else if (action === "ticket-submit") submitTicket(form);
  else if (action === "contact-submit") submitContact(form);
  else if (action === "admin-add-code") addCode(form);
}

function handleInput(e) {
  if (e.target.id === "adminSearch") filterAdminUsers(e.target.value);
  if (e.target.id === "signupUsername") {
    clearTimeout(usernameCheckTimer);
    usernameCheckTimer = setTimeout(() => checkUsernameAvailability(e.target.value.trim()), 400);
  }
}

function bindStaticEvents() {
  loginForm.addEventListener("submit", handleLogin);
  signupForm.addEventListener("submit", handleSignup);
  toggleButtons.forEach((b) => b.addEventListener("click", () => switchAuthForm(b.dataset.form)));

  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  goLogin.addEventListener("click", (e) => { e.preventDefault(); switchAuthForm("login"); });
  goSignup.addEventListener("click", (e) => { e.preventDefault(); switchAuthForm("signup"); });
  logoutBtn.addEventListener("click", logout);

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = getCurrentUser();
      if (!user) return;
      if (btn.dataset.section === "admin" && user.role !== "admin") {
        toast("Access denied. Admins only.", "error");
        return;
      }
      renderSection(btn.dataset.section, user);
    });
  });

  mobileMenuBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) closeSidebar();
    else openSidebar();
  });
  sidebarBackdrop.addEventListener("click", closeSidebar);
  themeToggle.addEventListener("click", toggleTheme);
  authThemeToggle.addEventListener("click", toggleTheme);

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

  dashboardContent.addEventListener("click", handleClick);
  dashboardContent.addEventListener("submit", handleSubmit);
  dashboardContent.addEventListener("input", handleInput);
}

async function init() {
  setupTheme();
  bindStaticEvents();
  await detectApi();
  await ensureSeedData();

  const user = await refreshCurrentUser();
  if (user) showDashboard(user);
  else { showAuth(); switchAuthForm("login"); }
}

init();
