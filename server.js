'use strict';

const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');

// ── Load config once at startup ──────────────────────────────────────────────
const configPath = path.join(__dirname, 'config', 'flags.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Validate config shape early so startup fails loudly rather than at request time
if (!config.challenges || config.challenges.length === 0) {
  throw new Error('flags.config.json must contain a non-empty "challenges" array');
}
if (!config.master_flag) {
  throw new Error('flags.config.json must contain a "master_flag" field');
}

// Build a Map for O(1) flag lookups: id → { id, title, prompt, flag }
const challengeMap = new Map(config.challenges.map(c => [c.id, c]));
const challengeIds = config.challenges.map(c => c.id);

// ── Placeholder mask generator ────────────────────────────────────────────────
// For a flag like CYS{1_4m_th3_0n3_wh0_kn0ck5}
// → inner content = "1_4m_th3_0n3_wh0_kn0ck5"
// → replace alphanumeric chars with *, keep _ and - as-is
// → result placeholder = "CYS{*_**_***_***_***_******}"
function buildPlaceholder(flagStr) {
  const match = flagStr.match(/^([A-Z0-9_]+\{)(.*?)(\})$/);
  if (!match) return flagStr; // fallback: show flag as-is (shouldn't happen)
  const [, prefix, inner, suffix] = match;
  const masked = inner.replace(/[A-Za-z0-9]/g, '*');
  return prefix + masked + suffix;
}

// Pre-compute safe challenge data for the view (NO flag values)
const safeChallenges = config.challenges.map(c => ({
  id: c.id,
  title: c.title,
  prompt: c.prompt,
  placeholder: buildPlaceholder(c.flag),
}));

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Signed cookie-session — state lives client-side but cannot be tampered with
// (cookie-session uses keygrip HMAC signing; a tampered value is silently
// treated as an empty session, so faked "all-solved" cookies are rejected)
const cookieSecret = process.env.COOKIE_SECRET || 'ctf-dev-secret-change-me-in-production';
app.use(cookieSession({
  name: 'flagsession',
  keys: [cookieSecret],
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,
  sameSite: 'lax',
  // secure: true is set automatically by Render (HTTPS), but we allow HTTP locally
}));

// ── Routes ────────────────────────────────────────────────────────────────────

// Main page — passes ONLY safe data (no flag values)
app.get('/', (req, res) => {
  const solved = req.session.solved || {};
  res.render('index', {
    siteTitle: config.site_title,
    siteSubtitle: config.site_subtitle,
    challenges: safeChallenges,
    solved,                    // which IDs are marked solved in the session
    totalFlags: challengeIds.length,
  });
});

// API routes
const apiRouter = require('./routes/api');
// Inject config dependencies into the router via app.locals so routes stay pure
app.locals.challengeMap = challengeMap;
app.locals.challengeIds = challengeIds;
app.locals.config = config;
app.use('/api', apiRouter);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Flag checker running on http://localhost:${PORT}`);
  if (cookieSecret === 'ctf-dev-secret-change-me-in-production') {
    console.warn('[WARN] Using default COOKIE_SECRET — set COOKIE_SECRET env var before deploying!');
  }
});
