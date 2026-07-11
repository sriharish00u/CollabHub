# CollabHub

Skill-verified teammate-matching platform for hackathons, projects, and competitions. Users build a self-rated skill profile; activity creators declare required skills and minimum levels; the platform auto-calculates a match score and eligibility for every applicant.

Full spec: see `CollabHub_PRD.md`.

## Tech Stack

- **Backend:** FastAPI (Python), MongoDB, JWT auth (`python-jose`), `passlib`/bcrypt for password hashing, `email-validator` for input validation
- **Frontend:** Static HTML pages, plain CSS (`assets/css/styles.css`), plain JS (`assets/js/`) — no framework, no CDN dependencies, no build tool beyond a small config-generation script
- **Hosting target:** Render/Railway for backend, any static host (Vercel/Netlify/GitHub Pages) for frontend

## Folder Structure

```
backend/
  app.py              FastAPI routes + startup index creation
  func.py             DB models, settings, auth helpers, eligibility engine
  requirements.txt
  .env.example        Backend env template (no real credentials)
pages/                All app screens (26 HTML files)
assets/
  css/styles.css      Shared stylesheet (no CDN, no Google Fonts, self-hosted icons)
  fonts/              Self-hosted Material Symbols WOFF2 font
  js/config.js        Generated from .env — API base URL (gitignored)
  js/api.js           Fetch wrapper for every backend endpoint + auth guard
  js/pages/           Per-page JS (26 files, one per page)
scripts/
  build-config.js     Reads root .env and writes assets/js/config.js
index.html            Redirects to pages/dev_index.html
.env.example          Frontend env (API_BASE_URL)
```

## Backend Setup

```bash
cd backend
cp .env.example .env      # fill in your MongoDB URI and a real SECRET_KEY
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Required env vars (`backend/.env`):

| Key | Description |
|---|---|
| `DATABASE_URL` | MongoDB connection string |
| `SECRET_KEY` | JWT signing secret — generate a real random value, don't use the placeholder |
| `ALGORITHM` | JWT algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime |
| `DB_NAME` | Mongo database name |
| `FRONTEND_ORIGIN` | Comma-separated allowed origins for CORS, e.g. `http://localhost:5500` |

## Frontend Setup

```bash
cp .env.example .env      # set API_BASE_URL to your backend URL
node scripts/build-config.js
npx serve .                # or use VS Code Live Server
```

`.env` (root):

| Key | Description |
|---|---|
| `API_BASE_URL` | URL of the running backend, e.g. `http://localhost:8000` in dev or your deployed Render URL in production |

Re-run `node scripts/build-config.js` any time `API_BASE_URL` changes.

## Security Notes

- **No secrets in source code:** All credentials are loaded from `.env` files (gitignored). Only `.env.example` templates with placeholder values are committed.
- **CORS:** `FRONTEND_ORIGIN` in the backend `.env` must match whatever origin you're serving the frontend from. Wildcard origins are not used.
- **JWT secrets:** Generate a real random value for `SECRET_KEY` — the placeholder is not secure.
- **Password hashing:** bcrypt via `passlib`. Passwords are never stored in plaintext.
- **Email validation:** Server-side validation via `pydantic.EmailStr` and `email-validator`.
- **Unique index:** MongoDB unique index on `users.email` prevents duplicate registrations.

## Architecture Notes

- **Frontend-to-backend:** All 26 HTML pages call the FastAPI backend via `assets/js/api.js` — a fetch wrapper that handles JWT storage, auth headers, and error handling.
- **Auth guard:** Pages requiring authentication call `requireAuth()` which redirects to `login.html` if no valid JWT is found.
- **No CDN dependencies:** Tailwind CSS, Google Fonts, and Google Material Symbols have been removed. All styles are in `assets/css/styles.css` and the Material Symbols font is self-hosted in `assets/fonts/`.
- **Self-hosted icons:** The Material Symbols Outlined font is served locally from `assets/fonts/MaterialSymbolsOutlined.woff2`. No external font CDN is loaded.
