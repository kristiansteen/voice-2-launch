# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a home directory (`C:\Users\krist`) used as a git repository containing multiple independent projects:

| Project | Description | Stack |
|---|---|---|
| `vimpl-saas/` | Visual planning board SaaS (main active project) | Node.js/TypeScript + Express + Prisma + Supabase |
| `ailean/` | Lead generation service with email integration | Node.js/Express (backend) + static HTML (frontend) |
| `web-ui/` | Browser-use Web UI for AI agent interaction | Python + Gradio + Playwright |
| `bpmn-interview-agent/` | BPMN interview agent | Static HTML |

---

## vimpl-saas

### Architecture

- **Backend** (`vimpl-saas/backend/`): TypeScript/Express REST API with Prisma ORM connecting to Supabase (PostgreSQL)
- **Frontend** (`vimpl-saas/frontend/`): Static HTML/CSS/JS pages served separately (no build step)

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

**Auth**: JWT tokens + Google OAuth via Passport.js. Subscription tiers: `student`, `commercial`, `enterprise`.

### Commands (run from `vimpl-saas/backend/`)

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
