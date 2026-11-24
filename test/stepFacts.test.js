import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTime, cleanDecision, cleanRework, cleanDescription, toMinutes, formatTime } from '../src/lib/stepFacts.js';

test('cleanTime keeps a stated time and drops anything unknown or broken', () => {
  assert.deepEqual(cleanTime({ value: 10, unit: 'min', source: 'measured' }), { value: 10, unit: 'min', source: 'measured' });
  assert.deepEqual(cleanTime({ value: '2', unit: 'day' }), { value: 2, unit: 'day', source: 'estimated' });
  assert.deepEqual(cleanTime({ value: 3, unit: 'hours' }), { value: 3, unit: 'hr', source: 'estimated' });
  assert.equal(cleanTime(null), null);
  assert.equal(cleanTime({ value: 0, unit: 'min' }), null);
  assert.equal(cleanTime({ value: 'unknown', unit: 'min' }), null);
  assert.equal(cleanTime({ value: 5, unit: 'fortnight' }), null);
});

test('cleanDecision needs a question and at least two outcomes', () => {
  assert.deepEqual(
    cleanDecision({ question: ' Over DKK 50k? ', outcomes: [{ condition: 'Yes', next: 'CFO approval' }, { condition: 'No', next: '' }] }),
    { question: 'Over DKK 50k?', outcomes: [{ condition: 'Yes', next: 'CFO approval' }, { condition: 'No', next: '' }] },
  );
  assert.equal(cleanDecision({ question: 'Q?', outcomes: [{ condition: 'Yes' }] }), null);
  assert.equal(cleanDecision({ question: '', outcomes: [{ condition: 'a' }, { condition: 'b' }] }), null);
  assert.equal(cleanDecision('yes'), null);
});

test('cleanRework needs the step it goes back to', () => {
  assert.deepEqual(cleanRework({ back_to: 'Check PO', when: 'PO is wrong' }), { back_to: 'Check PO', when: 'PO is wrong' });
  assert.deepEqual(cleanRework({ back_to: 'Check PO' }), { back_to: 'Check PO', when: '' });
  assert.equal(cleanRework({ when: 'sometimes' }), null);
});

test('cleanDescription cleans every step and removes empty facts', () => {
  const d = cleanDescription({
    process_name: 'P',
    steps: [
      { order: 1, name: 'A', performer: 'x', description: '', touch_time: { value: 5, unit: 'min' }, wait_time: null, decision: null, rework: null },
      { order: 2, name: 'B', performer: 'y', description: '', touch_time: { value: 'n/a' }, decision: { question: 'OK?', outcomes: [{ condition: 'yes' }, { condition: 'no' }] } },
    ],
  });
  assert.deepEqual(d.steps[0], { order: 1, name: 'A', performer: 'x', description: '', touch_time: { value: 5, unit: 'min', source: 'estimated' } });
  assert.deepEqual(Object.keys(d.steps[1]).sort(), ['decision', 'description', 'name', 'order', 'performer']);
  assert.equal(cleanDescription(null), null);
});

test('toMinutes and formatTime', () => {
  assert.equal(toMinutes({ value: 2, unit: 'hr' }), 120);
  assert.equal(toMinutes({ value: 1, unit: 'day' }), 1440);
  assert.equal(toMinutes(null), null);
  assert.equal(formatTime({ value: 10, unit: 'min', source: 'measured' }, 'en'), '10 min');
  assert.equal(formatTime({ value: 2, unit: 'day', source: 'estimated' }, 'en'), '~2 days');
  assert.equal(formatTime({ value: 1, unit: 'day', source: 'estimated' }, 'da'), '~1 dag');
  assert.equal(formatTime({ value: 3, unit: 'week', source: 'measured' }, 'da'), '3 uger');
});
