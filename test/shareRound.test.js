import test from 'node:test';
import assert from 'node:assert/strict';
import { splitEmails, shareSummary, versionsForFlow } from '../src/lib/shareRound.js';

test('splitEmails: commas, new lines, "Name <email>", lower-cased, no duplicates', () => {
  assert.deepEqual(splitEmails('Mette <Mette@firma.dk>, jonas@firma.dk\nmette@firma.dk; oops'), {
    valid: ['mette@firma.dk', 'jonas@firma.dk'],
    invalid: ['oops'],
  });
  assert.deepEqual(splitEmails('  '), { valid: [], invalid: [] });
});

const round = {
  invites: [
    { id: 'i1', email: 'mette@firma.dk', status: 'submitted' },
    { id: 'i2', email: 'jonas@firma.dk', status: 'started' },
    { id: 'i3', email: 'lars@firma.dk', status: 'invited' },
  ],
  submissions: [
    { id: 's1', status: 'submitted', participantEmail: 'Mette@firma.dk', participantName: 'Mette', submittedAt: '2026-11-20', contribution: { description: { steps: [{ name: 'A' }] }, transcript: 't1' } },
    { id: 's2', status: 'started', participantEmail: 'jonas@firma.dk', participantName: 'Jonas', contribution: {} },
    { id: 's3', status: 'submitted', participantEmail: 'anna@firma.dk', participantName: 'Anna', submittedAt: '2026-11-21', contribution: { description: { steps: [{ name: 'B' }] }, transcript: 't3' } },
    { id: 's4', status: 'submitted', participantEmail: 'owner@firma.dk', participantName: 'Owner', submittedAt: '2026-11-19', contribution: { description: { steps: [{ name: 'old' }] }, transcript: 'old' } },
  ],
};

test('shareSummary counts everyone asked or answering once, and who has described it', () => {
  // mette, jonas, lars (invited) + anna (came via the link) + the owner's own old answer is not counted
  assert.deepEqual(shareSummary(round, 'owner@firma.dk'), { people: 4, described: 2, waiting: 2, remindable: 0 });
  assert.deepEqual(shareSummary(null, 'x'), { people: 0, described: 0, waiting: 0, remindable: 0 });
});

test('versionsForFlow puts the owner\'s own description first, then each submitted answer', () => {
  const own = { description: { steps: [{ name: 'Mine' }] }, transcript: 'mine' };
  const v = versionsForFlow(round, own, { name: 'Kristian', email: 'owner@firma.dk' });
  assert.deepEqual(v.map(x => [x.name, x.isOwner]), [['Kristian', true], ['Mette', false], ['Anna', false]]);
  assert.equal(v[0].description.steps[0].name, 'Mine');
});

test('versionsForFlow leaves the owner out when the flow has no description yet', () => {
  const v = versionsForFlow(round, { description: null, transcript: '' }, { name: 'K', email: 'owner@firma.dk' });
  assert.deepEqual(v.map(x => x.name), ['Mette', 'Anna']);
});
