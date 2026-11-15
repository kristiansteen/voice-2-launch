// Pure helpers for AS-IS round invitations. No React, no network.
//
// An invite link is /?round=<token>. The login redirects drop the query string,
// so the token is remembered in localStorage before login and taken once after.

export const INVITE_PARAM = 'round';
const STORAGE_KEY = 'ailean.pendingRoundInvite';

export function inviteUrl(origin, token) {
  return `${origin}/?${INVITE_PARAM}=${encodeURIComponent(token)}`;
}

export function readInviteFromSearch(search) {
  const v = new URLSearchParams(search || '').get(INVITE_PARAM);
  return v ? v : null;
}

export function rememberInvite(storage, token) {
  try { storage.setItem(STORAGE_KEY, token); } catch { /* private mode: invite is lost on redirect */ }
}

/** Returns the remembered invite token and forgets it. */
export function takePendingInvite(storage) {
  try {
    const token = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    return token || null;
  } catch {
    return null;
  }
}

/** Context sent to the voice interviewer so the participant stays inside the round's scope. */
export function scopeContextMessage(round, lang) {
  const { processName, startTrigger, endPoint } = round;
  if (lang === 'da') {
    return `Processen der kortlægges er "${processName}". Den starter når: "${startTrigger}". Den slutter når: "${endPoint}". ` +
      'Hold interviewet inden for dette forløb. Hvis personen beskriver noget før starten eller efter slutningen, så anerkend det kort og før samtalen tilbage.';
  }
  return `The process being mapped is "${processName}". It starts when: "${startTrigger}". It ends when: "${endPoint}". ` +
    'Keep the interview inside this stretch. If the person describes something before the start or after the end, acknowledge it briefly and steer back.';
}

export function statusCounts(submissions) {
  const counts = { opened: 0, started: 0, submitted: 0 };
  (submissions || []).forEach(s => { if (s.status in counts) counts[s.status]++; });
  return counts;
}
