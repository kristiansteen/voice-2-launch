import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCategoryFilter } from '../src/lib/improveFilter.js';
import { touchTimeFigure } from '../src/lib/processMetrics.js';

test('category filter falls back to all when its category is gone', () => {
  const imps = [{ category: 'automation' }, { category: 'clarity' }];
  assert.equal(resolveCategoryFilter('risk', imps), 'all');
  assert.equal(resolveCategoryFilter('clarity', imps), 'clarity');
  assert.equal(resolveCategoryFilter('all', imps), 'all');
  assert.equal(resolveCategoryFilter('clarity', [{ category: 'clarity' }]), 'all'); // chips hidden → no filter
  assert.equal(resolveCategoryFilter('clarity', null), 'all');
});

test('touch-time figure says longer when the TO-BE is slower', () => {
  assert.deepEqual(touchTimeFigure({ touchReduction: 71, basedOnEstimates: true }), { value: '71 %', key: 'planShorterTouch', estimate: true });
  assert.deepEqual(touchTimeFigure({ touchReduction: -15, basedOnEstimates: false }), { value: '15 %', key: 'planLongerTouch', estimate: false });
  assert.deepEqual(touchTimeFigure(null), { value: '—', key: 'planShorterTouch', estimate: false });
  assert.deepEqual(touchTimeFigure({ touchReduction: null }), { value: '—', key: 'planShorterTouch', estimate: false });
});
