# AS-IS rounds: several people describe the same process

Design, 15 November 2026. Status: awaiting approval.

## Why

Today one interview becomes the AS-IS. That maps the process as one person described it, not as it is performed. The places where people's accounts differ are where the real process problems sit, and the tool currently hides them.

## What it does

A process owner invites several people to describe the same process. Each does the Ailean interview on their own. Ailean combines the versions into one draft AS-IS with every disagreement marked on it and traceable to who said what. The owner settles the disagreements, in a workshop or alone, and promotes the draft to the actual AS-IS.

## Goals

- An owner can start a round, share a link, and see who has contributed.
- A participant can contribute with only the link and a login.
- The draft shows the common process, with each disagreement described in plain words on the step it concerns.
- Every version behind a disagreement links to its root source: that person's submission, at the passage where they said it.
- The owner resolves each disagreement and the decisions are kept as a record.
- A late submission adds to the picture without reopening settled points.

## Not in this version

- Sending invitation emails. The owner copies the link and sends it themselves.
- Participants seeing each other's versions or the draft.
- Participants editing a diagram. They confirm a step list.
- Live multi-user editing of the draft.
- Disagreements about which system is used. The interview asks about systems, but the extraction does not record a system per step yet.
- Anonymous contributions.

## Planned for a later version

- Invitation emails sent by Ailean, with reminders to people who have not contributed. Until then the round keeps a participant list by login only, so nothing built now blocks this.

## What would make it a failure

- A draft that looks authoritative while resting on guesses: invented quotes, wrong counts, or steps matched wrongly with no way to correct them.
- Five diagrams side by side that the owner has to compare by eye.
- Participants who did not know the owner could read their input by name.
- Any effect on existing single-interview flows, or on the offline USB version.

## Constraints found in the code

- A flow belongs to one login. The server (`kristiansteen/vimpl`, `backend/`) only lets the owner list, save and delete their own flows. Rounds need new tables and endpoints there.
- The `backend/` folder inside `voice-2-launch` is an incomplete copy and is not what runs in production.
- The vimpl backend has no migration history; schema changes are applied with `prisma db push`. Applying the new tables to the production database is a manual step for Kristian.
- Free accounts may create one flow, checked in the browser (`canCreateFlow` in `App.jsx`).
- AI usage is logged per user but not capped (`api/_auth.js`, `usage.controller.ts`).
- Login redirects drop the query string (`App.jsx`, `returnTo`), so an invite link must survive the login round trip another way.
- The voice interviewer's script lives in ElevenLabs. An earlier attempt to override its prompt from the app was rejected by ElevenLabs, so passing the process scope to the interviewer needs care.
- Time disagreements build on the waiting-time and source work on branch `feat/metric-provenance-wait-time`, which must be merged first.

## Approaches considered

**A. One AI pass over all transcripts.** Fastest. Rejected: not repeatable, a new submission redoes everything and can reopen settled points, and quotes and counts come from the model.

**B. AI matches the steps, code finds the disagreements. Chosen.** The model does one job, deciding which steps across submissions are the same step. Code computes what differs and builds the draft from the majority. Counts are repeatable and testable, quotes are verified against the transcript, and the owner can correct a wrong match.

**C. Compare everyone against the owner's version.** Cheapest, reuses the blueprint comparison. Rejected: it shows deviation from the owner's view rather than where the group disagrees.

## Decided by Kristian

- The process owner names the process when inviting.
- Each participant logs in or signs up.
- Disagreements are not grouped by role. Each is described on the draft and linked to its root source.
- The owner resolves each disagreement; the draft is promoted when none are open; the resolved list is kept.
- Names are visible to the owner.
- Approach B.

## How it works

### Round and invitation

The owner starts a round from the dashboard: process name, start trigger, end point, language. The start and end are required so everyone describes the same stretch. The round gets an unguessable link. The owner sees a list of participants with status (opened, interviewing, submitted) and can close the round or issue a new link, which kills the old one.

### Participant

1. Opens the link. If not logged in, logs in or signs up and lands back on the invitation.
2. Sees the process name, start and end, who invited them, and a notice that the process owner can read their input by name.
3. Does the Ailean interview. The interviewer is told the process name, start and end.
4. Sees the step list Ailean extracted and confirms it, or redoes the interview.
5. Submits. They can resubmit until the round is closed, and withdraw their submission.

A contribution is stored in the round, not as one of the participant's own flows, so it does not use up a free account's single flow.

### Combining the versions

Runs when the owner opens the draft and there are at least two submissions.

1. **Match steps (AI).** Input: each submission's steps, decisions and roles with their names and descriptions. Output: a list of common steps, each listing which elements of which submission belong to it. Several elements of one submission may map to one common step, so a difference in level of detail is not treated as a disagreement. Code checks that every element is placed exactly once and repairs the result if not. For a later submission, the existing common steps are fixed and only the new elements are placed.
2. **Find disagreements (code).**
   - Step present in some versions, absent in others.
   - Order: two steps occur in opposite order in different versions.
   - Who does it: different performers for the same step.
   - Decision: a decision point exists in some versions only, or its outcomes differ.
   - Rework: a loop back exists in some versions only.
   - Time: touch or waiting time for a step differs by more than a factor of two between versions.
3. **Build the draft (code).** Steps named by a majority, in majority order, with majority performer and decisions, and median times. The result uses the existing diagram format and layout. With two submissions, or a tie, the draft follows the owner's own version if they contributed one, otherwise the earliest, and the point is marked.
4. **Find the source passage (AI, checked by code).** For each version behind a disagreement the model returns a verbatim quote. It is shown only if that exact text is found in the person's transcript. Otherwise the panel shows that person's own step description, labelled as such, and the link opens their submission at the step.

### Owner's view

The draft diagram with a marker on every element that has an open disagreement, a counter of open and resolved points, and a side panel per marker as sketched in the conversation: description, the versions with names, quote and "open source", and the choices.

- **Use this version**: the draft is rebuilt with that choice.
- **Edit manually**: the owner writes what the answer is. The point is closed with that note and the owner adjusts the diagram after promotion in the normal editor.
- **Not a real difference**: closed with no change.
- **Same step / not the same step**: corrects a wrong match and recomputes.

"Open source" shows that participant's transcript, scrolled to the passage, and their own diagram, read-only.

### Promotion

Enabled when no disagreement is open. The draft becomes the AS-IS of a normal flow owned by the owner, and the usual Identify, Map, Plan, Launch steps continue from there. The flow keeps the decision record (what was disputed, what was chosen, by whom, when) and a link back to the round. The round is marked promoted and becomes read-only.

## Data

In the vimpl backend:

- `AsIsRound`: owner, process name, start trigger, end point, language, invite token, status (open, closed, promoted), draft state (step matches, owner corrections, resolutions), resulting flow id.
- `AsIsSubmission`: round, user, status (started, submitted), contribution (transcript, extracted steps, description, metrics), timestamps. One per user per round.

Endpoints, all requiring login:

- Owner: create round, list own rounds, read a round with all submissions, save draft state, close, renew link, mark promoted.
- Participant: read an invitation by token (scope, owner name, own status only), save and submit own contribution, withdraw.

Access rules, each with a test: a participant never receives another participant's data; only the owner reads submissions; a closed round or old link accepts nothing.

## Calls I made, for Kristian to check

1. Starting a round requires a paid plan (commercial or enterprise). Participants can be on any plan. Without this, a free account could run unlimited interviews by inviting itself.
2. Participant AI usage is logged against the participant, tagged with the round, so the owner's total can be reported later. No cap in this version.
3. The owner contributes like any participant if they want their own version counted.
4. Rounds exist only in the online version; the offline build hides the feature.
5. The working name is "round" (Danish: "runde").
6. A draft needs at least two submissions.

## Order of work

1. **Rounds and contributions.** Backend tables and endpoints, invitation link through login, participant interview and submit, owner's status list. Usable on its own: the owner can read each submission.
2. **Draft with disagreements.** Step matching, disagreement detection, draft diagram with markers and the side panel.
3. **Sources, resolution and promotion.** Verified quotes, open source view, resolving, match corrections, promotion and decision record.

## Risks

- **Step matching quality** decides whether the draft is trustworthy. Mitigations: many-to-one matches, code validation, owner corrections, and a test set of submissions with known disagreements.
- **Telling the interviewer the scope** may hit the same ElevenLabs restriction as before. Fallback: the invitation screen states the scope and the interviewer's first question asks the participant to confirm it.
- **Small rounds.** With two or three people "majority" means little; the draft says how many versions it rests on.

## Left to the builder

File and component names, exact endpoint paths, prompt wording for matching and quotes, the marker's visual style, and how the invite token is carried through login.
