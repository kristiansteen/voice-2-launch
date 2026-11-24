import test from 'node:test';
import assert from 'node:assert/strict';

import {
  versionsFromRound, stepRefs, validateGroups, combine, applyResolution, findPassage, combinedTranscript,
  groupingLooksBroken, resolveDisagreement,
} from '../src/lib/roundMerge.js';

const step = (order, name, performer, description = '') => ({ order, name, performer, description });
const desc = (steps, extra = {}) => ({
  process_name: 'x', overview: 'o', scope: 's', roles: [], exceptions: [], known_issues: [], steps, ...extra,
});
const sub = (id, name, email, submittedAt, description, transcript = '') => ({
  id, status: 'submitted', participantName: name, participantEmail: email, submittedAt,
  contribution: { description, transcript },
});

// Owner (Kristian) submitted last; Anna first; Lars second.
const ROUND = {
  processName: 'Invoice approval',
  submissions: [
    sub('sa', 'Anna', 'anna@x.dk', '2026-11-15T10:00:00Z', desc([step(1, 'Receive invoice', 'AP clerk'), step(2, 'Approve', 'Manager'), step(3, 'Code invoice', 'AP clerk')]),
      'Interviewer: What happens first?\n\nSME: We receive the invoice by email.\n\nInterviewer: Then?\n\nSME: The manager approves it before anyone codes the invoice.'),
    sub('sl', 'Lars', 'lars@x.dk', '2026-11-15T10:05:00Z', desc([step(1, 'Invoice arrives', 'AP clerk'), step(2, 'Code invoice', 'AP clerk'), step(3, 'Manager approval', 'Manager')])),
    sub('sk', 'Kristian', 'k@x.dk', '2026-11-15T10:10:00Z', desc([step(1, 'Receive invoice', 'Finance'), step(2, 'Approve', 'Manager'), step(3, 'Code invoice', 'AP clerk'), step(4, 'Archive', 'AP clerk')])),
    { id: 'so', status: 'started', participantName: 'Open', participantEmail: 'o@x.dk', contribution: {} },
  ],
};

function threeVersions() {
  const versions = versionsFromRound(ROUND, ['sa', 'sl', 'sk'], 'k@x.dk');
  const refs = stepRefs(versions);
  // Expected AI grouping: v0 = Kristian (owner first), v1 = Anna, v2 = Lars
  const groups = validateGroups([
    { name: 'Receive invoice', refs: ['v0s0', 'v1s0', 'v2s0'] },
    { name: 'Approve invoice', refs: ['v0s1', 'v1s1', 'v2s2'] },
    { name: 'Code invoice', refs: ['v0s2', 'v1s2', 'v2s1'] },
    { name: 'Archive', refs: ['v0s3'] },
  ], refs);
  return { versions, refs, groups };
}

test('versionsFromRound', async (t) => {
  await t.test('puts the owner\'s version first, the rest by submission time, and skips unselected or unsubmitted', () => {
    const v = versionsFromRound(ROUND, ['sa', 'sl', 'sk', 'so'], 'k@x.dk');
    assert.deepEqual(v.map(x => [x.id, x.name, x.isOwner]), [['sk', 'Kristian', true], ['sa', 'Anna', false], ['sl', 'Lars', false]]);
  });
  await t.test('without the owner, the earliest submission comes first', () => {
    assert.deepEqual(versionsFromRound(ROUND, ['sl', 'sa'], 'k@x.dk').map(x => x.id), ['sa', 'sl']);
  });
  await t.test('falls back to the email when there is no name', () => {
    const r = { ...ROUND, submissions: [{ ...ROUND.submissions[0], participantName: null }] };
    assert.equal(versionsFromRound(r, ['sa'], null)[0].name, 'anna@x.dk');
  });
});

test('stepRefs numbers each version\'s steps', () => {
  const refs = stepRefs(versionsFromRound(ROUND, ['sa', 'sl'], null));
  assert.deepEqual(refs.slice(0, 2).map(r => [r.ref, r.versionId, r.index, r.name]), [['v0s0', 'sa', 0, 'Receive invoice'], ['v0s1', 'sa', 1, 'Approve']]);
  assert.equal(refs.length, 6);
});

test('validateGroups repairs a bad grouping so every step appears exactly once', () => {
  const refs = stepRefs(versionsFromRound(ROUND, ['sa', 'sl'], null));
  const g = validateGroups([
    { name: 'Receive', refs: ['v0s0', 'v1s0', 'v9s9'] },     // unknown ref dropped
    { name: 'Approve', refs: ['v0s1', 'v1s2', 'v0s0'] },     // duplicate v0s0 stays in first group
    { name: 'Empty', refs: ['nope'] },                       // empty after cleaning → dropped
    { name: 'Code', refs: ['v0s2'] },                        // v1s1 missing → own group
  ], refs);
  const all = g.flatMap(x => x.refs).sort();
  assert.deepEqual(all, refs.map(r => r.ref).sort());
  assert.equal(new Set(all).size, all.length);
  assert.ok(g.some(x => x.refs.length === 1 && x.refs[0] === 'v1s1' && x.name === 'Code invoice'));
  assert.deepEqual(g.map(x => x.key), g.map((_, i) => `g${i}`));
  assert.equal(validateGroups('garbage', refs).length, refs.length);
});

test('combine', async (t) => {
  const { versions, groups } = threeVersions();
  const { description, disagreements } = combine(versions, groups, 'Invoice approval');
  const byType = type => disagreements.filter(d => d.type === type);

  await t.test('the draft follows the majority order and uses the round\'s process name', () => {
    assert.equal(description.process_name, 'Invoice approval');
    assert.deepEqual(description.steps.map(s => s.name), ['Receive invoice', 'Approve invoice', 'Code invoice']);
    assert.deepEqual(description.steps.map(s => s.order), [1, 2, 3]);
    assert.ok(description.steps.every(s => s._key));
  });
  await t.test('a step only one of three versions has is left out and marked', () => {
    const [d] = byType('missing');
    assert.equal(d.stepName, 'Archive');
    assert.equal(d.chosen, 'exclude');
    assert.deepEqual(d.options.find(o => o.key === 'include').versionIds, ['sk']);
    assert.deepEqual(d.options.find(o => o.key === 'exclude').versionIds, ['sa', 'sl']);
  });
  await t.test('different performers are marked and the majority wins', () => {
    const [d] = byType('performer');
    assert.equal(d.stepName, 'Receive invoice');
    assert.equal(description.steps[0].performer, 'AP clerk');
    assert.deepEqual(d.options.map(o => [o.label, o.versionIds]), [['AP clerk', ['sa', 'sl']], ['Finance', ['sk']]]);
  });
  await t.test('opposite order of two steps is marked', () => {
    const [d] = byType('order');
    assert.equal(d.stepName, 'Code invoice');
    assert.equal(d.otherStepName, 'Approve invoice');
    assert.deepEqual(d.options.find(o => o.key === 'ab').versionIds, ['sk', 'sa']);
    assert.deepEqual(d.options.find(o => o.key === 'ba').versionIds, ['sl']);
    assert.equal(d.chosen, 'ab');
  });
  await t.test('each version behind a disagreement has its step text and a transcript passage when one matches', () => {
    const [d] = byType('order');
    assert.match(d.sources.sa.passage, /approves it before anyone codes/);
    assert.equal(d.sources.sl.passage, null);
    assert.match(d.sources.sl.stepText, /Code invoice/);
  });
  await t.test('every disagreement has a unique id', () => {
    assert.equal(new Set(disagreements.map(d => d.id)).size, disagreements.length);
  });
});

test('combine with two versions: a step in one of them follows the preferred version', () => {
  const versions = versionsFromRound(ROUND, ['sa', 'sk'], 'k@x.dk'); // Kristian preferred
  const refs = stepRefs(versions);
  const groups = validateGroups([
    { name: 'Receive invoice', refs: ['v0s0', 'v1s0'] },
    { name: 'Approve', refs: ['v0s1', 'v1s1'] },
    { name: 'Code invoice', refs: ['v0s2', 'v1s2'] },
    { name: 'Archive', refs: ['v0s3'] },
  ], refs);
  const { description, disagreements } = combine(versions, groups, 'p');
  assert.deepEqual(description.steps.map(s => s.name), ['Receive invoice', 'Approve', 'Code invoice', 'Archive']);
  assert.equal(disagreements.find(d => d.type === 'missing').chosen, 'include');
  // Performer tie (Finance vs AP clerk) follows the preferred version
  assert.equal(description.steps[0].performer, 'Finance');
});

test('combine merges roles, exceptions and known issues without duplicates', () => {
  const a = sub('a', 'A', 'a@x', '2026-01-01', desc([step(1, 'S', 'P')], { roles: [{ name: 'Manager', responsibilities: 'approves' }], exceptions: ['Missing PO'], known_issues: ['Slow'] }));
  const b = sub('b', 'B', 'b@x', '2026-01-02', desc([step(1, 'S', 'P')], { roles: [{ name: 'manager ', responsibilities: 'x' }, { name: 'Clerk', responsibilities: 'y' }], exceptions: ['missing PO', 'Wrong VAT'], known_issues: [] }));
  const versions = versionsFromRound({ processName: 'p', submissions: [a, b] }, ['a', 'b'], null);
  const groups = validateGroups([{ name: 'S', refs: ['v0s0', 'v1s0'] }], stepRefs(versions));
  const { description } = combine(versions, groups, 'p');
  assert.deepEqual(description.roles.map(r => r.name), ['Manager', 'Clerk']);
  assert.deepEqual(description.exceptions, ['Missing PO', 'Wrong VAT']);
  assert.deepEqual(description.known_issues, ['Slow']);
});

test('applyResolution acts on the step by key, keeping the user\'s other edits', async (t) => {
  const { versions, groups } = threeVersions();
  const { description, disagreements } = combine(versions, groups, 'p');
  const d = type => disagreements.find(x => x.type === type);
  // User renames step 1 and swaps steps 2 and 3 before resolving anything
  const edited = { ...description, steps: [{ ...description.steps[0], name: 'Invoice received' }, description.steps[2], description.steps[1]] };

  await t.test('include inserts the missing step after its neighbour and renumbers', () => {
    const r = applyResolution(edited, d('missing'), 'include');
    assert.deepEqual(r.steps.map(s => s.name), ['Invoice received', 'Code invoice', 'Approve invoice', 'Archive']);
    assert.deepEqual(r.steps.map(s => s.order), [1, 2, 3, 4]);
    assert.equal(applyResolution(r, d('missing'), 'include').steps.length, 4); // idempotent
  });
  await t.test('exclude removes it again', () => {
    const r = applyResolution(applyResolution(edited, d('missing'), 'include'), d('missing'), 'exclude');
    assert.equal(r.steps.length, 3);
  });
  await t.test('performer sets the performer and keeps the renamed step name', () => {
    const r = applyResolution(edited, d('performer'), 'p1');
    assert.equal(r.steps[0].performer, 'Finance');
    assert.equal(r.steps[0].name, 'Invoice received');
  });
  await t.test('order puts the two steps in the chosen order', () => {
    const ab = applyResolution(edited, d('order'), 'ab');
    assert.deepEqual(ab.steps.map(s => s.name), ['Invoice received', 'Approve invoice', 'Code invoice']);
    const ba = applyResolution(ab, d('order'), 'ba');
    assert.deepEqual(ba.steps.map(s => s.name), ['Invoice received', 'Code invoice', 'Approve invoice']);
  });
  await t.test('does nothing when the step was deleted by the user', () => {
    const removed = { ...description, steps: description.steps.slice(1) };
    assert.deepEqual(applyResolution(removed, d('performer'), 'p1'), removed);
  });
});

test('findPassage', async (t) => {
  await t.test('finds the participant\'s words in an interview transcript, without the speaker prefix', () => {
    const tr = 'Interviewer: Who approves the invoice?\n\nSME: The department manager approves every invoice above 10,000.\n\nSME: Then we pay.';
    assert.equal(findPassage(tr, 'Manager approval: department manager approves the invoice'), 'The department manager approves every invoice above 10,000.');
  });
  await t.test('works on a pasted transcript without prefixes', () => {
    const tr = 'First we get the invoice by mail.\n\nThen accounting codes the invoice against the purchase order.';
    assert.match(findPassage(tr, 'Code invoice against purchase order'), /codes the invoice/);
  });
  await t.test('never returns the interviewer\'s words', () => {
    assert.equal(findPassage('Interviewer: Do you code the invoice against the purchase order?', 'Code invoice purchase order'), null);
  });
  await t.test('returns null when nothing matches well', () => {
    assert.equal(findPassage('SME: We sail on Sundays.', 'Approve invoice'), null);
    assert.equal(findPassage('', 'Approve invoice'), null);
  });
  await t.test('shortens long passages', () => {
    const tr = `SME: approve invoice ${'word '.repeat(200)}`;
    assert.ok(findPassage(tr, 'approve invoice').length <= 301);
  });
});

test('combinedTranscript puts each transcript under the participant\'s name', () => {
  const versions = versionsFromRound(ROUND, ['sa', 'sl'], null);
  const t = combinedTranscript(versions);
  assert.match(t, /^=== Anna ===\n/);
  assert.match(t, /=== Lars ===/);
  assert.match(t, /We receive the invoice by email/);
});


// ── Fixes from review ────────────────────────────────────────────────────────

function threeWith(stepsA, stepsB, stepsC) {
  const r = { processName: 'p', submissions: [
    sub('a', 'A', 'a@x', '2026-01-01', desc(stepsA)),
    sub('b', 'B', 'b@x', '2026-01-02', desc(stepsB)),
    sub('c', 'C', 'c@x', '2026-01-03', desc(stepsC)),
  ] };
  return versionsFromRound(r, ['a', 'b', 'c'], null);
}

test('a blank performer never outvotes a named one', () => {
  const versions = threeWith([step(1, 'S', 'AP clerk')], [step(1, 'S', '')], [step(1, 'S', '  ')]);
  const { description, disagreements } = combine(versions, validateGroups([{ name: 'S', refs: ['v0s0', 'v1s0', 'v2s0'] }], stepRefs(versions)), 'p');
  assert.equal(description.steps[0].performer, 'AP clerk');
  assert.equal(disagreements.filter(d => d.type === 'performer').length, 0);
});

test('two different named performers are still a disagreement when others left it blank', () => {
  const versions = threeWith([step(1, 'S', 'AP clerk')], [step(1, 'S', 'Manager')], [step(1, 'S', '')]);
  const { disagreements } = combine(versions, validateGroups([{ name: 'S', refs: ['v0s0', 'v1s0', 'v2s0'] }], stepRefs(versions)), 'p');
  const d = disagreements.find(x => x.type === 'performer');
  assert.deepEqual(d.options.map(o => o.label), ['AP clerk', 'Manager']);
});

test('findPassage quotes the matching sentence of a long paragraph, not its opening', () => {
  const para = 'SME: Every morning I start by sorting the shared mailbox and moving newsletters away from the inbox so that the real messages stand out. '
    + 'Most days that takes a while because people send all sorts of things there. '
    + 'When an invoice is there, the department manager approves the invoice before anything else happens.';
  assert.equal(findPassage(para, 'Manager approves invoice'), 'When an invoice is there, the department manager approves the invoice before anything else happens.');
});

test('groupingLooksBroken flags a grouping that matched almost nothing', () => {
  const versions = threeWith(
    [step(1, 'Receive', 'x'), step(2, 'Approve', 'x'), step(3, 'Pay', 'x')],
    [step(1, 'Receive', 'x'), step(2, 'Approve', 'x'), step(3, 'Pay', 'x')],
    [step(1, 'Receive', 'x'), step(2, 'Approve', 'x'), step(3, 'Pay', 'x')],
  );
  const refs = stepRefs(versions);
  assert.equal(groupingLooksBroken(validateGroups([], refs), refs), true);
  const good = validateGroups([
    { name: 'Receive', refs: ['v0s0', 'v1s0', 'v2s0'] }, { name: 'Approve', refs: ['v0s1', 'v1s1', 'v2s1'] }, { name: 'Pay', refs: ['v0s2', 'v1s2'] },
  ], refs); // v2s2 left on its own: a real difference, not a broken grouping
  assert.equal(groupingLooksBroken(good, refs), false);
});

test('resolveDisagreement', async (t) => {
  const { versions, groups } = threeVersions();
  const { description, disagreements } = combine(versions, groups, 'p');
  const snapshot = { versions: [], disagreements, resolutions: {} };
  const performer = disagreements.find(d => d.type === 'performer');

  await t.test('"keep the draft" records the decision without touching the user\'s edits', () => {
    const edited = { ...description, steps: description.steps.map((s, i) => (i === 0 ? { ...s, performer: 'Typed by hand' } : s)) };
    const r = resolveDisagreement(edited, snapshot, performer.id, null);
    assert.equal(r.description, edited);
    assert.equal(r.snapshot.resolutions[performer.id].option, 'kept');
  });
  await t.test('choosing an option applies it and records it', () => {
    const r = resolveDisagreement(description, snapshot, performer.id, 'p1');
    assert.equal(r.description.steps[0].performer, 'Finance');
    assert.equal(r.snapshot.resolutions[performer.id].option, 'p1');
    assert.ok(r.snapshot.resolutions[performer.id].at);
  });
  await t.test('an unknown disagreement changes nothing', () => {
    const r = resolveDisagreement(description, snapshot, 'nope', 'p1');
    assert.equal(r.description, description);
    assert.equal(r.snapshot, snapshot);
  });
});

test('combine carries the preferred version\'s times, decision and rework onto the step', () => {
  const facts = {
    touch_time: { value: 10, unit: 'min', source: 'estimated' },
    decision: { question: 'Over 50k?', outcomes: [{ condition: 'Yes', next: 'CFO' }, { condition: 'No', next: '' }] },
  };
  const versions = [
    { id: 'a', name: 'A', isOwner: true, description: desc([{ ...step(1, 'Approve', 'Manager'), ...facts }]), transcript: '' },
    { id: 'b', name: 'B', isOwner: false, description: desc([{ ...step(1, 'Approve', 'Manager'), touch_time: { value: 2, unit: 'hr', source: 'estimated' } }]), transcript: '' },
  ];
  const groups = validateGroups([{ name: 'Approve', refs: ['v0s0', 'v1s0'] }], stepRefs(versions));
  const { description } = combine(versions, groups, 'P');
  assert.deepEqual(description.steps[0].touch_time, facts.touch_time);
  assert.deepEqual(description.steps[0].decision, facts.decision);
  assert.equal(description.steps[0].rework, undefined);
});
