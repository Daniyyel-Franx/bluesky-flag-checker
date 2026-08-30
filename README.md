# Flag Checker

A self-contained CTF flag submission site. Participants submit 8 flags into individual input boxes, get instant per-flag feedback, and unlock a master flag once all 8 are solved.

**Tech stack**: Node.js · Express · EJS · cookie-session  
**Theme**: Cyberpunk blue/violet

---

## Local development

### Prerequisites
- Node.js ≥ 18

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd flag-checker

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# Edit .env and set COOKIE_SECRET to a long random string:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Start
npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration

Edit [`config/flags.config.json`](config/flags.config.json) to set:

| Field | Description |
|---|---|
| `site_title` | Displayed in the header and browser tab |
| `site_subtitle` | Tagline under the title |
| `master_flag` | The final flag revealed after all 8 are solved |
| `master_flag_reveal_message` | Message shown alongside the master flag |
| `challenges[].title` | Card heading for each challenge |
| `challenges[].prompt` | One-line question/hint shown on the card |
| `challenges[].flag` | The correct flag string (server-side only, never sent to client) |

> **Security note**: `flags.config.json` is the single source of truth for all flag values. They are **never** sent to the browser — all validation happens server-side.

---

## Deploy on Render

### Step-by-step

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Go to [render.com](https://render.com) → **New → Web Service**.
3. Connect your repository.
4. Set the following in the Render dashboard:

| Setting | Value |
|---|---|
| **Environment** | `Node` |
| **Build command** | `npm install` |
| **Start command** | `npm start` |
| **Branch** | `main` (or your default branch) |

5. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `COOKIE_SECRET` | A long random string (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `PORT` | *(leave blank — Render sets this automatically)* |

6. Click **Deploy**.

### Why `cookie-session` instead of a memory store?

Render's free tier spins services down after inactivity and cold-starts them on the next request. Any in-memory session store would silently wipe participant progress on a cold start. `cookie-session` stores all state in the **signed cookie itself** (client-side), so progress survives restarts — the session data travels with the browser, not the server process.

---

## Security model

| Concern | Mitigation |
|---|---|
| Flag values leaked to browser | Config is read server-side only; the view receives stripped objects (id/title/prompt/placeholder). Flag values are never in any HTML, JSON response, or JS bundle. |
| Forged "all-solved" cookie | `cookie-session` signs cookies with `COOKIE_SECRET` using HMAC. A tampered cookie fails signature verification and is treated as empty. |
| Master flag guessed without solving | `/api/master-flag` re-reads the signed session and checks all 8 IDs before responding. A direct `curl` with no cookie or a partial cookie returns `403`. |
| Placeholder reveals flag content | Placeholders are computed server-side: alphanumeric characters inside `{}` are replaced with `*`; separators (`_`, `-`) are kept. The character count matches the flag but no characters are disclosed. |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `COOKIE_SECRET` | **Yes (production)** | Secret for HMAC signing of session cookies. The app falls back to a dev default and logs a warning if unset — always set this in production. |
| `PORT` | No | Port to listen on. Defaults to `3000`. Render sets this automatically. |
