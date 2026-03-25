# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Active Projects & Vercel Deployments

**There are exactly 4 active Vercel projects. Never search for, reference, or deploy to any other project.**

| # | Vercel project | Live URL | Local source folder |
|---|---|---|---|
| 1 | `voice-2-launch` | https://voice-2-launch.vercel.app | `voice-2-bpmn/` |
| 2 | `ailean` | (ailean Vercel project) | `ailean/` |
| 3 | `frontend` | https://frontend-puce-ten-18.vercel.app | `frontend/` |
| 4 | `backend` | https://backend-eight-rho-46.vercel.app | `backend/` |

**Deployment commands:**
```bash
# voice-2-launch
cd voice-2-bpmn && npx vercel --prod

# frontend
cd frontend && npx vercel --prod

# backend
cd backend && npx vercel --prod

# ailean — deploy from ailean/ folder
```

**Retired/non-existent — never reference these:** `vimpl-saas`, `vimpl-sl96`, `DELETE vimpl-saas`, `voice-2-bpmn` (as a Vercel project name)

---

## Repository Overview

| Folder | Vercel project | Description | Stack |
|---|---|---|---|
| `backend/` | `backend` | Visual planning board API | Node.js/TypeScript + Express + Prisma + Supabase |
| `frontend/` | `frontend` | Visual planning board UI | Static HTML/CSS/JS |
| `voice-2-bpmn/` | `voice-2-launch` | Voice-to-Launch app | React + Tailwind + Vite |
| `ailean/` | `ailean` | Lead generation service | Node.js/Express + static HTML |
| `web-ui/` | — | Browser-use AI agent UI (not deployed) | Python + Gradio |

---

## backend

### Architecture

- TypeScript/Express REST API with Prisma ORM connecting to Supabase (PostgreSQL)

**API structure** (`backend/src/`):
- `server.ts` — Express app entry point, middleware setup, route registration
- `routes/` — Route definitions (`auth`, `board`, `portfolio`, `subscription`, `admin`, `eventlog`, `lead`)
- `controllers/` — Request handlers per resource
- `services/` — Business logic layer
- `middleware/` — Auth (JWT + Passport), rate limiting
- `config/` — Environment config, Swagger spec, database client
- `auth/googleAuth.ts` — Google OAuth2 strategy
- `utils/logger.ts` — Winston logger

**Database models**: User, Board, Section, Postit, TeamMember, BoardCollaborator, EventLog, LoginAudit, Session

**Auth**: JWT tokens + Google OAuth via Passport.js. Subscription tiers: `trial`, `commercial`, `enterprise`.

### Auth endpoints
- `POST /auth/forgot-password` — sends reset email (always 200, never reveals if email exists)
- `POST /auth/reset-password` — validates token, hashes new password, clears token
- Reset tokens: `crypto.randomBytes(32).toString('hex')`, stored on User model, 1-hour expiry

### Board collaboration
- `POST /boards/:id/share` — grants access if user exists + sends invite email with embedded JWT invite token
- `POST /boards/accept-invite` — validates JWT invite token, matches to logged-in user's email, creates `BoardCollaborator` record
- Invite tokens: signed JWT `{ boardId, email, type: 'board_invite' }`, 7-day expiry, embedded in board URL as `?invite=<token>`
- `BoardCollaborator.userId` is required (non-nullable) — no pending invites without a user account; JWT invite token pattern solves new-user case

### Email sending
- **All emails must use** `from: 'Ailean from Vimpl <ailean@onboard.vimpl.com>'` — this is the only verified Resend sender domain
- Using any other domain (e.g. `hello@vimpl.com`) causes silent delivery failure
- Email templates: `backend/src/email-templates/` (Day0–Day07) — HTML files, copied to `dist/` on build
- Logo images hosted at `https://frontend-puce-ten-18.vercel.app/assets/images/`
  - Header: `vimpl.png` at 96px height (dark background)
  - Footer: `15_vimpl_primary_dark_transparent.png` at 36px height (white background)

### Discord notifications
- `backend/src/services/discord.service.ts` — posts to Discord via bot token
- Env vars: `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`
- Fires on: new user signup, new Ailean lead, onboarding email failure

### Commands (run from `backend/`)

```bash
npm run dev          # Start with tsx watch (hot reload)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled JS
npm run lint         # ESLint on src/
npm run format       # Prettier on src/
npm test             # Jest tests
npm run db:generate  # Prisma client generation
npm run db:migrate   # Run migrations (dev)
npm run db:push      # Push schema changes directly
npm run db:studio    # Open Prisma Studio
```

**Environment**: Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` (Supabase PostgreSQL connection string).

---

## frontend

Static HTML/CSS/JS pages for the visual planning board. No build step — files are served directly by Vercel.

---

## ailean

### Architecture

- **Backend** (`ailean/backend/`): CommonJS Express server (`server.js`), stores leads in a JSON flat file (`data/leads.json`), sends emails via Resend API
- **Frontend** (`ailean/frontend/`): Static HTML pages served by the backend as static files

### Commands (run from `ailean/backend/`)

```bash
npm start    # Start server on port 3001
```

---

## web-ui

Python Gradio app wrapping the `browser-use` library for AI-driven browser automation.

### Commands (run from `web-ui/`)

```bash
uv venv --python 3.11   # Create virtualenv
source .venv/bin/activate  # Activate (Linux/Mac)
.venv\Scripts\activate     # Activate (Windows)
pip install -r requirements.txt
python webui.py             # Start Gradio UI
```

Docker is also supported via `docker-compose.yml`.

---

## voice-2-bpmn (deploys to voice-2-launch)

React + Tailwind single-page app. Entry: `voice-2-bpmn/src/main.jsx`. Build: `npm run dev` / `npm run build` from `voice-2-bpmn/`.

### Auth & API Key Policy

All Anthropic and ElevenLabs API calls are proxied server-side via Vercel serverless functions. Users authenticate with their vimpl account (JWT). No user-facing API key input.

| Serverless function | Purpose |
|---|---|
| `api/proxy.js` | Anthropic API — validates vimpl JWT, forwards to Claude |
| `api/tts.js` | ElevenLabs TTS — validates vimpl JWT, returns audio |

#### Auth flow
1. User signs in with Google or vimpl account → receives JWT
2. JWT stored in `localStorage['voice2bpmn_vimpl_config']`
3. Every API call sends `Authorization: Bearer <jwt>` to `/api/proxy` or `/api/tts`
4. Proxy validates JWT via `GET ${BACKEND_URL}/api/v1/auth/me`

#### Subscription tiers & flow limits
- `trial` — 1 flow (default for new users)
- `commercial` / `enterprise` — unlimited flows
- Demo flows (`_demo: true`) never count against the trial quota

#### Required Vercel environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic key for proxy |
| `ELEVENLABS_API_KEY` | ElevenLabs key for TTS proxy |
| `VIMPL_BACKEND_URL` | Backend URL for JWT validation |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

### Free Session Cost Estimate

One full Voice-to-Launch workflow on `claude-sonnet-4-20250514` ($3/M input, $15/M output):

| Step | Input tokens | Output tokens | Cost |
|---|---|---|---|
| Parse voice → description | ~1,500 | ~1,000 | ~$0.02 |
| Parse description → BPMN | ~2,000 | ~1,500 | ~$0.03 |
| Get improvements | ~2,000 | ~1,500 | ~$0.03 |
| Generate project plan | ~3,000 | ~2,500 | ~$0.05 |
| Generate TO-BE BPMN | ~3,000 | ~2,000 | ~$0.04 |
| **Total** | **~11,500** | **~8,500** | **~$0.17** |

With Ailean interview follow-ups (optional, ~5 turns): add ~$0.02–0.03. Worst-case per free session: **~$0.20**.
