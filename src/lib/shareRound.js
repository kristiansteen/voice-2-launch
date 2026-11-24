// Pure helpers for sharing a flow: asking colleagues by email to describe its process.
// No React, no network.

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const lower = s => (s || '').trim().toLowerCase();

/** Same rules as the backend: "a@b.dk, c@d.dk", one per line, or "Name <a@b.dk>". */
export function splitEmails(text) {
  const parts = String(text || '').replace(/[^<>]*<([^>]+)>/g, ' $1 ').split(/[\s,;]+/);
  const valid = [];
  const invalid = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (EMAIL.test(p)) { const e = p.toLowerCase(); if (!valid.includes(e)) valid.push(e); }
    else if (!invalid.includes(p)) invalid.push(p);
  }
  return { valid, invalid };
}

/** Everyone asked or answering (the owner left out), how many have described it, and how many can be reminded. */
export function shareSummary(round, ownerEmail) {
  if (!round) return { people: 0, described: 0, waiting: 0, remindable: 0 };
  const owner = lower(ownerEmail);
  const people = new Set();
  const described = new Set();
  for (const i of round.invites || []) people.add(lower(i.email));
  for (const s of round.submissions || []) {
    const e = lower(s.participantEmail);
    if (!e || e === owner) continue;
    people.add(e);
    if (s.status === 'submitted') described.add(e);
  }
  people.delete(owner);
  return {
    people: people.size,
    described: described.size,
    waiting: people.size - described.size,
    remindable: (round.invites || []).filter(i => i.canRemind).length,
  };
}

/**
 * The versions to combine in Review: the owner's own description of the flow first
 * (when there is one), then every submitted answer from someone else.
 */
export function versionsForFlow(round, own, owner) {
  const ownerEmail = lower(owner?.email);
  const versions = [];
  if (own?.description?.steps?.length) {
    versions.push({
      id: 'own', name: owner?.name || owner?.email || 'You', isOwner: true, submittedAt: null,
      description: own.description, transcript: own.transcript || '',
    });
  }
  for (const s of round?.submissions || []) {
    if (s.status !== 'submitted' || !s.contribution?.description) continue;
    if (ownerEmail && lower(s.participantEmail) === ownerEmail) continue;
    versions.push({
      id: s.id, name: s.participantName || s.participantEmail, isOwner: false, submittedAt: s.submittedAt,
      description: s.contribution.description, transcript: s.contribution.transcript || '',
    });
  }
  return versions.sort((a, b) => (b.isOwner - a.isOwner) || String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

/**
 * Rounds from before sharing lived in flows: each one without a flow is attached to the flow
 * that was made from it, or gets a new flow. A closed round nobody ever opened is left alone.
 */
export function planRoundAdoption(rounds, flows) {
  const plan = [];
  for (const r of rounds || []) {
    if (r.flowId) continue;
    const made = (flows || []).find(f => !f._demo && f.roundSnapshot?.roundId === r.id);
    if (made) { plan.push({ roundId: r.id, linkTo: made.id }); continue; }
    const c = r.counts || {};
    const activity = (c.opened || 0) + (c.started || 0) + (c.submitted || 0);
    if (r.status === 'closed' && activity === 0) continue;
    plan.push({ roundId: r.id, create: { processName: r.processName } });
  }
  return plan;
}
