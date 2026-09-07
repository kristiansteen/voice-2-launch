# voice-2-launch — Unit Test Summary

_Added 2026-09-07._

## What was tested

The Ailean voice interviewer hook (`src/hooks/useAileanInterviewer.js`) mixed
React state with a handful of small decision functions buried in the ElevenLabs
`useConversation` callbacks. Those decisions were extracted into pure functions in
**`src/lib/aileanInterview.js`**; the hook now imports them. Behaviour is
unchanged and `npm run build` still succeeds.

| Unit | Responsibility |
|---|---|
| `deriveErrorText(msg)` | Normalise a string / Error-like / junk error into a display string |
| `normalizeMode(m)` | Collapse SDK mode to `speaking` or `listening` |
| `normalizeStatus(s)` | Accept either `{ status }` or a bare status string |
| `turnFromMessage({message, source})` | Map an SDK message to an `ailean` / `user` transcript turn |
| `computeEnabled({connecting, sdkConnected, mode})` | Whether the mic UI is active (incl. the synchronous-reset case) |
| `computeThinking({connecting, sdkConnected})` | "Connecting but not yet connected" state |
| `buildSessionConfig(agentId, language)` | The `startSession` config incl. the interview prompt override |

## How to run

```bash
npm test
```

Uses the built-in Node test runner (`node --test`) — no new dependencies.

## Outcome

```
tests 25
pass  25
fail  0
```

All 25 tests pass. `npm run build` is clean after the refactor.

## Notes / follow-ups

- Coverage is the pure logic only, per request. The hook's React state
  transitions and the live ElevenLabs socket are not exercised — that would
  need `@testing-library/react` + a test DOM.
- `INTERVIEW_PROMPT` now lives in `src/lib/aileanInterview.js` (previously a
  local const in the hook).
