# AS-IS Rounds, Part 2: Use Submissions in Review or as a Diagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** From a round, the owner turns selected submissions into a new flow, opened in the Review pane with disagreements to settle, or directly as a process diagram.

**Architecture:** One pure module (`src/lib/roundMerge.js`) does everything except step matching: version extraction, group repair, combining, resolutions and finding source passages. One AI call (`matchRoundSteps`) decides which steps are the same. The flow stores a `roundSnapshot`. UI: selection and two buttons on the round screen, a disagreements list in the Review pane, an open-points chip on the diagram.

**Tech Stack:** React 18, Vite, `node --test`, Anthropic SDK through the existing proxy.

**Spec:** `docs/superpowers/specs/2026-11-15-as-is-rounds-design.md` (section "Update, 15 November 2026")

## Global Constraints

- Nothing in the backend changes.
- A source passage is shown only if it is copied from the transcript; the AI never writes quotes.
- Existing flows without `roundSnapshot` behave exactly as before.
- Copy in English and Danish.

## Review Focus

1. **AI returns a bad grouping** (a step missing, a step in two groups, an unknown id) — every step must still appear exactly once. Test: `validateGroups` repair cases (Task 1).
2. **User edits the Review pane before resolving** — resolving must act on the step by its key, not its position, and not undo other edits. Test: `applyResolution` after a reorder and a rename (Task 1).
3. **Two versions only** — a step in one of two versions is a disagreement and follows the preferred version. Test: `combine` with two versions (Task 1).
4. **Pasted transcripts without "SME:" prefixes** — passage search must still work. Test: `findPassage` on plain paragraphs (Task 1).
5. **Matching call fails** (network, bad JSON) — the owner gets a clear message and nothing is created. Test: `matchRoundSteps` throws; App shows the message (Task 3, manual).

### Task 1: `src/lib/roundMerge.js` (pure)

**Interfaces (produced):**
- `versionsFromRound(round, submissionIds, ownerEmail) → Version[]` where `Version = { id, name, isOwner, submittedAt, description, transcript }`, preferred version first (owner's if selected, else earliest `submittedAt`), the rest by `submittedAt`
- `stepRefs(versions) → [{ ref, versionId, index, name, performer, description }]`, `ref = "v<i>s<j>"`
- `validateGroups(raw, refs) → [{ key, name, refs: string[] }]` — unknown refs dropped, duplicates kept in their first group, missing refs become their own group, empty groups dropped, `key = "g<n>"`
- `combine(versions, groups, processName) → { description, disagreements }` — description steps carry `_key`; disagreement `{ id, type: 'missing'|'order'|'performer', key, stepName, options: [{ key, label, versionIds }], chosen, sources: { [versionId]: { stepText, passage } }, ...type data }`
- `applyResolution(description, disagreement, optionKey) → description` (renumbers `order`)
- `findPassage(transcript, text) → string | null`
- `combinedTranscript(versions) → string`

Tests in `test/roundMerge.test.js`: preferred-version order; repair cases (Review Focus 1); two-version missing step follows preferred (Focus 3); performer majority and tie; order disagreement detected and draft follows majority; exceptions/known issues de-duplicated; `applyResolution` include/exclude/performer/order by key after user edits (Focus 2); `findPassage` with and without prefixes, and `null` when nothing matches (Focus 4).

### Task 2: `matchRoundSteps` in `src/services/anthropicService.js`

`matchRoundSteps(refs, apiKey, proxyAuth, lang) → Promise<[{ name, refs }]>` using `MODEL_SONNET`; throws on unparseable output. Prompt: group steps that describe the same activity, several steps of one version may form one group, never merge different activities to make versions agree, name each group in the round's language.

### Task 3: Flow wiring in `src/App.jsx`

- `roundSnapshot` in `blankFlowState`, `loadFlowIntoState`, the save effect and its dependencies, and `handleCreateFlow`.
- `handleUseSubmissions({ round, submissionIds, mode })`: build versions; one version → its description; several → `matchRoundSteps` + `validateGroups` + `combine`. Creates a new flow with the combined description, combined transcript and snapshot `{ roundId, processName, createdAt, versions: [{ id, name, transcript }], disagreements, resolutions: {} }`, opens panel 2; mode `diagram` then approves with that description.
- `handleApproveToBpmn(useExtendedTokens, descOverride)`.
- `handleResolve(disagreementId, optionKey)`: `applyResolution` on the current description and record `{ option, at }`.

### Task 4: UI

- `RoundsPanel`: checkboxes on submitted rows (all checked by default), buttons "Open in Review" and "Open as process diagram", busy state and error message.
- `src/components/RoundDisagreements.jsx` shown at the top of the Review pane: open points with options and version names, each version's source passage (or own step text, labelled) and its full transcript; resolved points collapsed.
- `DiagramPanel`: chip "N open points" leading to the Review pane when the flow has unresolved disagreements.
