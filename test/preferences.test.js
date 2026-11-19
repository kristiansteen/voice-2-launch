import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferencesToStorage, taxonomyPreferencesFromStorage, KEYS } from '../src/services/preferencesService.js';

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), dump: () => Object.fromEntries(m) };
}

test('saved preferences are written to the browser keys the app reads', () => {
  const st = fakeStorage();
  const lang = applyPreferencesToStorage({ preferredLang: 'da', taxonomySource: 'custom', customTaxonomyName: 'Ours', customTaxonomy: [{ id: '1', name: 'A', level: 1, parentId: null }] }, st);
  assert.equal(lang, 'da');
  assert.equal(st.getItem(KEYS.lang), 'da');
  assert.equal(st.getItem(KEYS.source), 'custom');
  assert.equal(st.getItem(KEYS.customName), 'Ours');
  assert.deepEqual(JSON.parse(st.getItem(KEYS.custom)), [{ id: '1', name: 'A', level: 1, parentId: null }]);
});

test('missing keys leave the browser as it is', () => {
  const st = fakeStorage({ [KEYS.source]: 'msbpc' });
  assert.equal(applyPreferencesToStorage({}, st), null);
  assert.equal(st.getItem(KEYS.source), 'msbpc');
});

test('taxonomy choice is read back from the browser for saving', () => {
  const st = fakeStorage({ [KEYS.source]: 'custom', [KEYS.customName]: 'Ours', [KEYS.custom]: '[{"id":"1","name":"A","level":1,"parentId":null}]' });
  assert.deepEqual(taxonomyPreferencesFromStorage(st), {
    taxonomySource: 'custom', customTaxonomyName: 'Ours', customTaxonomy: [{ id: '1', name: 'A', level: 1, parentId: null }],
  });
  assert.deepEqual(taxonomyPreferencesFromStorage(fakeStorage({ [KEYS.source]: 'apqc' })), { taxonomySource: 'apqc', customTaxonomyName: null, customTaxonomy: null });
});
