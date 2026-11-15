# AS-IS Rounds, Part 1: Rounds, Invitation and Contributions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A process owner can start a round, share a link, and read each participant's contribution; a participant can open the link, log in, do the Ailean interview for that process, confirm their steps and submit.

**Architecture:** Two new Prisma models and one Express router in the vimpl backend, with all access rules in a pure policy module that is unit tested. In voice-2-launch, a pure invite helper module, a fetch wrapper, a participant screen and an owner screen, wired into `App.jsx` by state (the app has no router). The interviewer is told the scope with the ElevenLabs SDK's `sendContextualUpdate`, which needs no agent config change.

**Tech Stack:** Backend: Express, Prisma (PostgreSQL), TypeScript, Jest + ts-jest. Frontend: React 18, Vite, Tailwind, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-15-as-is-rounds-design.md`

**Repos:** backend tasks in `kristiansteen/vimpl` (`backend/`), branch `feat/as-is-rounds`. Frontend tasks in `kristiansteen/voice-2-launch`, branch `feat/as-is-rounds`.

## Global Constraints

- Starting a round requires `subscriptionTier` `commercial` or `enterprise`, or `isAdmin`. Participants can be on any plan.
- Every endpoint requires login (`authenticate` middleware).
- A participant never receives another participant's data. Only the owner reads submissions.
- A closed round, or an old link after renewal, accepts nothing.
- One submission per user per round.
- Start trigger and end point are required to start a round.
- A contribution is stored in the round, never as one of the participant's flows (does not count against the free plan's one flow).
- Participants see the notice that the process owner can read their input by name, before they start.
- Schema change adds two tables and relation fields only; no existing column changes (it is applied by hand with `prisma db push`).
- UI copy in English and Danish (`src/i18n/translations.js`); the working name is "round" / "runde".
- Existing single-interview flows behave exactly as before.

## Review Focus

1. **Invite token lost through login** — a logged-out participant who opens the link, signs up (including Google OAuth and the vimpl login redirect) must land on the invitation, not the dashboard. Test: `takePendingInvite` returns the token stored before redirect, once (Task 4).
2. **Owner opens their own invite link** — they should be able to contribute like anyone else, not get an error. Test: policy allows `canContribute` for the owner (Task 1).
3. **Link renewed while a participant is mid-interview** — their save must fail with a clear "link no longer valid" message, not lose silently. Test: contribution with old token → 404 view (Task 1) and the screen shows the message (Task 5).
4. **Participant resubmits after withdrawing** — must work while the round is open. Test: policy allows contribution when no submission exists (Task 1).
5. **Very long transcripts** (pasted, >50 kB) — save must not fail. Server JSON limit is 50 MB already; test: `validateContribution` accepts a 200 kB transcript and rejects a non-string (Task 1).

---

### Task 1: Round access policy (backend, pure)

**Files:**
- Create: `backend/src/services/round.policy.ts`
- Create: `backend/jest.config.js` (`preset: 'ts-jest'`, `testEnvironment: 'node'`, `roots: ['<rootDir>/src']`)
- Test: `backend/src/services/__tests__/round.policy.test.ts`

**Interfaces:**
- Produces:
  - `type RoundStatus = 'open' | 'closed' | 'promoted'`
  - `type SubmissionStatus = 'opened' | 'started' | 'submitted'`
  - `newInviteToken(): string` — 32 bytes from `crypto.randomBytes`, base64url
  - `canStartRound(user: { subscriptionTier: string | null; isAdmin: boolean }): boolean`
  - `validateRoundInput(body: unknown): { ok: true; value: { processName: string; startTrigger: string; endPoint: string; language: 'en' | 'da' } } | { ok: false; error: string }` — trims; each text 1–200 chars; language defaults `'en'`
  - `validateContribution(body: unknown): { ok: true; value: { status: 'opened' | 'started' | 'submitted'; contribution: Contribution } } | { ok: false; error: string }` where `Contribution = { transcript?: string; description?: object; parsed?: object; metrics?: object }`; `submitted` requires `transcript` and `description`
  - `canContribute(round: { status: RoundStatus }): boolean` — true only when `open`
  - `invitationView(round, owner: { name: string | null; email: string }, own: Submission | null)` → `{ id, processName, startTrigger, endPoint, language, status, ownerName, ownSubmission: { status, contribution, submittedAt } | null }` — never includes `inviteToken`, `ownerId` or other submissions
  - `ownerRoundView(round, submissions: Array<Submission & { user: { name: string | null; email: string } }>)` → round fields including `inviteToken`, plus `submissions: [{ id, status, participantName, participantEmail, contribution, updatedAt, submittedAt }]`
  - `roundSummary(round, counts: { opened: number; started: number; submitted: number })` for the list endpoint

- [ ] **Step 1: Write the failing tests**, including:
  - `canStartRound`: `commercial` → true, `enterprise` → true, `student` → false, `null` → false, `student` + `isAdmin` → true
  - `validateRoundInput`: missing `endPoint` → `{ ok: false }`; `'  Invoice approval  '` trimmed; 201-char name rejected; language `'de'` → `'en'`
  - `validateContribution`: `submitted` without `description` → error; `opened` with empty contribution → ok; 200 000-char transcript → ok; transcript `42` → error
  - `canContribute`: `open` → true, `closed` → false, `promoted` → false
  - `invitationView` has no `inviteToken`, no `ownerId`, and `ownSubmission` is `null` when none
  - `ownerRoundView` lists participant name and email per submission
  - `newInviteToken()` is ≥ 43 chars and two calls differ

- [ ] **Step 2: Run** `cd backend && npx jest src/services/__tests__/round.policy.test.ts` — Expected: FAIL, cannot find module `../round.policy`.
- [ ] **Step 3: Implement** `round.policy.ts` with the signatures above (no Prisma import).
- [ ] **Step 4: Run** the same command — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(rounds): access policy for AS-IS rounds`

### Task 2: Schema and round endpoints (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma` — add models; add `asIsRounds AsIsRound[]` and `asIsSubmissions AsIsSubmission[]` to `User`
- Create: `backend/src/routes/round.routes.ts`
- Modify: `backend/src/server.ts` — `app.use('/api/v1/rounds', roundRoutes)` next to `flowRoutes`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces (all under `/api/v1/rounds`, all `authenticate`):

| Method & path | Who | Result |
|---|---|---|
| `POST /` | paid owner | 201 `ownerRoundView`; 403 `{ error: 'PLAN_REQUIRED' }` if `!canStartRound`; 400 on invalid input |
| `GET /` | owner | `roundSummary[]`, newest first |
| `GET /:id` | owner | `ownerRoundView`; 404 if not found or not owner |
| `POST /:id/close` | owner | `ownerRoundView` with `status: 'closed'` |
| `POST /:id/reopen` | owner | `status: 'open'` (not allowed from `promoted` → 409) |
| `POST /:id/renew-link` | owner | new `inviteToken` |
| `GET /invite/:token` | anyone logged in | `invitationView`; 404 unknown token |
| `PUT /invite/:token/contribution` | anyone logged in | upsert own submission; 409 `{ error: 'ROUND_CLOSED' }` if `!canContribute`; sets `submittedAt` when status becomes `submitted` |
| `DELETE /invite/:token/contribution` | anyone logged in | deletes own submission; 409 if closed |

Schema:

```prisma
model AsIsRound {
  id           String   @id @default(uuid())
  ownerId      String   @map("owner_id")
  processName  String   @map("process_name")
  startTrigger String   @map("start_trigger")
  endPoint     String   @map("end_point")
  language     String   @default("en")
  inviteToken  String   @unique @map("invite_token")
  status       String   @default("open") // open | closed | promoted
  draft        Json?
  flowId       String?  @map("flow_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  owner        User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  submissions  AsIsSubmission[]
  @@index([ownerId])
  @@map("as_is_rounds")
}

model AsIsSubmission {
  id           String    @id @default(uuid())
  roundId      String    @map("round_id")
  userId       String    @map("user_id")
  status       String    @default("opened") // opened | started | submitted
  contribution Json      @default("{}")
  submittedAt  DateTime? @map("submitted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  round        AsIsRound @relation(fields: [roundId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([roundId, userId])
  @@index([userId])
  @@map("as_is_submissions")
}
```

- [ ] **Step 1: Add the models**, run `npx prisma validate` and `npx prisma generate` — Expected: valid, client generated.
- [ ] **Step 2: Write `round.routes.ts`** following `flow.routes.ts` style (try/catch, `logger.error`, 500 `{ error }`); routes contain no access logic beyond calling Task 1 functions. Register `/invite/:token...` routes before `/:id`.
- [ ] **Step 3: Run** `npx tsc --noEmit` and `npx jest` — Expected: no type errors, Task 1 tests still pass.
- [ ] **Step 4: Commit** `feat(rounds): schema and endpoints for AS-IS rounds`

### Task 3: Round service and invite helpers (frontend, pure + fetch)

**Files:**
- Create: `src/lib/roundInvite.js`
- Create: `src/services/roundService.js`
- Test: `test/roundInvite.test.js`

**Interfaces:**
- Produces in `src/lib/roundInvite.js`:
  - `INVITE_PARAM = 'round'`
  - `inviteUrl(origin: string, token: string): string` → `${origin}/?round=${token}`
  - `readInviteFromSearch(search: string): string | null`
  - `rememberInvite(storage, token: string): void` / `takePendingInvite(storage): string | null` — key `ailean.pendingRoundInvite`; `take` removes it
  - `scopeContextMessage(round: { processName, startTrigger, endPoint }, lang: 'en' | 'da'): string` — tells the interviewer the process, that it starts at the trigger and ends at the end point, and to keep the interview inside that scope
  - `statusCounts(submissions): { opened: number; started: number; submitted: number }`
- Produces in `src/services/roundService.js` (each `(token, ...) → Promise`, throws `Error` with `.status` and `.code` from the body on non-2xx; uses `BACKEND_URL`, `authHeaders` from `src/lib/api.js`):
  - `createRound(token, { processName, startTrigger, endPoint, language })`, `listRounds(token)`, `getRound(token, id)`, `closeRound(token, id)`, `reopenRound(token, id)`, `renewRoundLink(token, id)`
  - `getInvitation(token, inviteToken)`, `saveContribution(token, inviteToken, { status, contribution })`, `withdrawContribution(token, inviteToken)`

- [ ] **Step 1: Write failing tests** for `roundInvite.js`: URL round trip (`readInviteFromSearch(new URL(inviteUrl('https://x.dk','abc')).search) === 'abc'`); `readInviteFromSearch('?token=1')` → `null`; `takePendingInvite` returns the stored token then `null` on a second call (fake storage object); `scopeContextMessage` contains the process name, start and end in both languages, and the Danish version contains `"slutter"`; `statusCounts` counts each status.
- [ ] **Step 2: Run** `node --test test/roundInvite.test.js` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(rounds): invite helpers and round API client`

### Task 4: Invite survives login, interviewer gets the scope (frontend)

**Files:**
- Modify: `src/App.jsx` — mount effect (~line 134) and new state `pendingInvite`
- Modify: `src/hooks/useAileanInterviewer.js` — `useAileanInterviewer(lang, { contextMessage } = {})`
- Test: `test/roundInvite.test.js` (Review Focus 1 already covered by Task 3's `takePendingInvite` test)

**Interfaces:**
- Consumes: `readInviteFromSearch`, `rememberInvite`, `takePendingInvite`, `INVITE_PARAM` (Task 3).
- Produces: `App` state `pendingInvite: string | null`; hook option `contextMessage: string` sent once per session with `conversation.sendContextualUpdate(contextMessage)` in `onConnect`.

- [ ] **Step 1:** In the mount effect, before the token/code/refresh branches: if `readInviteFromSearch(location.search)` returns a token, `rememberInvite(localStorage, t)` and remove only the `round` param with `history.replaceState`. After auth resolves with a token, set `pendingInvite` from `takePendingInvite(localStorage)`.
- [ ] **Step 2:** Add `contextMessage` to the hook; keep it in a ref so `onConnect` reads the latest value; wrap the call in try/catch and log on failure (interview continues without it).
- [ ] **Step 3: Run** `npm test` and `npm run build` — Expected: pass, build succeeds.
- [ ] **Step 4: Commit** `feat(rounds): keep invite through login and pass scope to interviewer`

### Task 5: Participant contribution screen (frontend)

**Files:**
- Create: `src/components/RoundContribution.jsx`
- Modify: `src/App.jsx` — when `vimplToken && pendingInvite`, render `RoundContribution` instead of the dashboard/flow
- Modify: `src/i18n/translations.js` — keys prefixed `round`

**Interfaces:**
- Consumes: `getInvitation`, `saveContribution`, `withdrawContribution` (Task 3); `scopeContextMessage` (Task 3); `useAileanInterviewer(lang, { contextMessage })` (Task 4); existing `VoicePanel`, `parseVoiceToDescription`, `parseToBpmn`, `extractProcessMetrics`, `checkContentSafety`, `buildStructuredTranscript`.
- Props: `RoundContribution({ vimplToken, inviteToken, onDone })` — `onDone()` clears `pendingInvite` and shows the dashboard.

Screen states, in order:
1. **Invitation**: process name, start, end, "Invited by {ownerName}", the notice "{ownerName} can read what you say, with your name", button "Start". On load calls `saveContribution(..., { status: 'opened', contribution: {} })` only when there is no own submission yet.
2. **Interview**: `VoicePanel` with the round's language; on first turn saves `status: 'started'` with the transcript.
3. **Confirm**: the steps from `parseVoiceToDescription` as a numbered list (name, performer); buttons "This is right" and "Redo interview".
4. **Submitting**: runs `parseToBpmn` then `extractProcessMetrics`, then `saveContribution(..., { status: 'submitted', contribution: { transcript, description, parsed, metrics } })`. If BPMN or metrics fail, submit anyway with what exists.
5. **Submitted**: thank-you, "Change my answer" (back to Interview, round still open) and "Withdraw" (confirm, then `withdrawContribution`).

Errors: 404 from any call → "This link is no longer valid. Ask {ownerName or 'the process owner'} for a new one." 409 `ROUND_CLOSED` → "This round is closed."

- [ ] **Step 1: Build the component and wire it in `App.jsx`.**
- [ ] **Step 2: Run** `npm test` and `npm run build` — Expected: pass.
- [ ] **Step 3: Manual check** against a local backend (Task 2) with two accounts: open link logged out → sign up → lands on invitation; do a short pasted transcript instead of voice; confirm; submit; reload shows Submitted; withdraw; renew link as owner → participant save shows the "no longer valid" message.
- [ ] **Step 4: Commit** `feat(rounds): participant contribution screen`

### Task 6: Owner's rounds screen (frontend)

**Files:**
- Create: `src/components/RoundsPanel.jsx`
- Modify: `src/components/Dashboard.jsx` — "Rounds" button beside "New flow"; passes `onOpenRounds`
- Modify: `src/App.jsx` — state `showRounds`; render `RoundsPanel` when true
- Modify: `src/i18n/translations.js`

**Interfaces:**
- Consumes: `createRound`, `listRounds`, `getRound`, `closeRound`, `reopenRound`, `renewRoundLink` (Task 3); `inviteUrl`, `statusCounts` (Task 3); `rememberInvite` + `pendingInvite` setter (Task 4) for "Contribute yourself".
- Props: `RoundsPanel({ vimplToken, vimplUser, onBack, onContribute(inviteToken) })`.

Contents:
- **List**: each round with process name, status, counts (opened / interviewing / submitted), created date.
- **New round form**: process name, start trigger, end point, language; disabled with an upgrade note when `vimplUser.subscriptionTier` is not `commercial`/`enterprise` (server returns `PLAN_REQUIRED` too).
- **Round detail**: invite link with "Copy", "Renew link" (confirm: old link stops working), "Close" / "Reopen", "Contribute yourself", and the participant table: name, email, status, last update. Clicking a submitted row shows that participant's transcript and step list, read-only.
- Hidden entirely when `import.meta.env.VITE_OFFLINE === 'true'`.

- [ ] **Step 1: Build the component and wiring.**
- [ ] **Step 2: Run** `npm test` and `npm run build` — Expected: pass.
- [ ] **Step 3: Manual check**: student account sees the disabled form; commercial account creates a round, copies link, sees participant status move opened → interviewing → submitted, reads the submission, closes the round and the participant sees "closed".
- [ ] **Step 4: Commit** `feat(rounds): owner's rounds screen`

## Deferred to part 2

- Tagging participant AI usage with the round (needs a column on the existing `api_usage` table and a proxy header).
- Draft state, step matching, disagreements, promotion.
