import test from 'node:test';
import assert from 'node:assert/strict';

import { comparisonToImprovements } from '../src/services/processComparison.js';

test('comparisonToImprovements', async (t) => {
  await t.test('returns an empty array for no result', () => {
    assert.deepEqual(comparisonToImprovements(null), []);
    assert.deepEqual(comparisonToImprovements(undefined), []);
  });

  await t.test('returns an empty array when the result has no findings', () => {
    assert.deepEqual(comparisonToImprovements({}), []);
  });

  await t.test('maps a gap into a governance-category item', () => {
    const result = { gaps: [{ blueprint_step: 'Approve invoice', description: 'No approval step exists in AS-IS' }] };
    const items = comparisonToImprovements(result);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Approve invoice');
    assert.equal(items[0].category, 'governance');
    assert.equal(items[0].description, 'No approval step exists in AS-IS');
  });

  await t.test('maps a variation into a clarity-category item referencing both steps', () => {
    const result = { variations: [{ blueprint_step: 'Ship order', asis_step: 'Dispatch order', difference: 'Different carrier selection logic' }] };
    const items = comparisonToImprovements(result);
    assert.equal(items.length, 1);
    assert.equal(items[0].category, 'clarity');
    assert.match(items[0].benefit, /Dispatch order/);
  });

  await t.test('maps a recommendation string into an efficiency-category item', () => {
    const result = { recommendations: ['Automate the manual data entry step'] };
    const items = comparisonToImprovements(result);
    assert.equal(items.length, 1);
    assert.equal(items[0].category, 'efficiency');
    assert.equal(items[0].description, 'Automate the manual data entry step');
  });

  await t.test('combines all three kinds and assigns unique ids', () => {
    const result = {
      gaps: [{ blueprint_step: 'A', description: 'a' }],
      variations: [{ blueprint_step: 'B', asis_step: 'b', difference: 'diff' }],
      recommendations: ['do X'],
    };
    const items = comparisonToImprovements(result);
    assert.equal(items.length, 3);
    const ids = new Set(items.map(i => i.id));
    assert.equal(ids.size, 3);
  });

  await t.test('every item matches the improvement schema shape', () => {
    const result = { gaps: [{ blueprint_step: 'A', description: 'a' }] };
    const [item] = comparisonToImprovements(result);
    for (const key of ['id', 'title', 'category', 'description', 'benefit', 'effort', 'effort_score', 'impact_score', 'ai_candidate']) {
      assert.ok(key in item, `missing ${key}`);
    }
  });
});
