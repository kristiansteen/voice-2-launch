import test from 'node:test';
import assert from 'node:assert/strict';
import { trustFacts, DPA_URL, PRIVACY_URL } from '../src/lib/trust.js';
import { translations } from '../src/i18n/translations.js';

test('online build: badge says EU-hosted, facts name the AI providers and link the DPA', () => {
  const f = trustFacts({ offline: false });
  assert.equal(f.badgeKey, 'trustBadgeOnline');
  assert.deepEqual(f.items, ['trustStorage', 'trustTextAi', 'trustVoice', 'trustNoTraining', 'trustLocalOffer']);
  assert.deepEqual(f.links.map(l => l.href), [DPA_URL, PRIVACY_URL]);
});

test('offline build: badge says local, no provider is mentioned and no cloud links', () => {
  const f = trustFacts({ offline: true });
  assert.equal(f.badgeKey, 'trustBadgeOffline');
  assert.deepEqual(f.items, ['trustLocalOnly']);
  assert.deepEqual(f.links, []);
});

test('DPA and privacy notice point to the shared pages on app.vimpl.com', () => {
  assert.equal(DPA_URL, 'https://app.vimpl.com/dpa.html');
  assert.equal(PRIVACY_URL, 'https://app.vimpl.com/privacy.html');
});

test('every trust text exists in English and Danish', () => {
  const keys = new Set(['trustTitle']);
  for (const offline of [false, true]) {
    const f = trustFacts({ offline });
    keys.add(f.badgeKey);
    f.items.forEach(k => keys.add(k));
    f.links.forEach(l => keys.add(l.labelKey));
  }
  for (const lang of ['en', 'da']) for (const k of keys) assert.ok(translations[lang][k], `${lang}.${k}`);
});
