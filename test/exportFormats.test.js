import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_FORMATS } from '../src/lib/exportFormats.js';
import { translations } from '../src/i18n/translations.js';

test('export menu lists BPMN, SOP and Quick Suite in that order', () => {
  assert.deepEqual(EXPORT_FORMATS.map(f => f.id), ['bpmn', 'sop', 'quick']);
});
test('every format has a label and hint in English and Danish', () => {
  for (const lang of ['en', 'da']) {
    for (const f of EXPORT_FORMATS) {
      assert.ok(translations[lang][f.labelKey], `${lang}.${f.labelKey}`);
      assert.ok(translations[lang][f.hintKey], `${lang}.${f.hintKey}`);
    }
    assert.ok(translations[lang].exportMenu, `${lang}.exportMenu`);
  }
});
