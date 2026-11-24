import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaci, nextLetter, raciIssues, raciCsv, suggestionToOverrides, setCell } from '../src/lib/raci.js';

const description = {
  roles: [{ name: 'Employee' }, { name: 'Procurement officer' }, { name: 'CFO' }],
  steps: [
    { order: 1, name: 'Submit request', performer: 'Employee' },
    { order: 2, name: 'Check supplier', performer: 'procurement officer' },
    { order: 3, name: 'Book delivery', performer: 'Warehouse' },
    { order: 4, name: 'Archive', performer: '' },
  ],
};

test('buildRaci: one column per role, performers not in the role list added, performer is A/R by default', () => {
  const r = buildRaci(description, {});
  assert.deepEqual(r.roles, ['Employee', 'Procurement officer', 'CFO', 'Warehouse']);
  assert.deepEqual(r.rows.map(x => x.step), ['Submit request', 'Check supplier', 'Book delivery', 'Archive']);
  assert.equal(r.rows[1].cells['Procurement officer'], 'A/R');
  assert.equal(r.rows[1].cells.CFO, '');
  assert.deepEqual(Object.values(r.rows[3].cells), ['', '', '', '']);
});

test('buildRaci: saved choices replace the defaults, keyed by step and role name', () => {
  const overrides = { 'check supplier': { cfo: 'A', 'procurement officer': 'R' } };
  const r = buildRaci(description, overrides);
  assert.equal(r.rows[1].cells.CFO, 'A');
  assert.equal(r.rows[1].cells['Procurement officer'], 'R');
});

test('nextLetter cycles blank → R → A → A/R → C → I → blank', () => {
  assert.deepEqual(['', 'R', 'A', 'A/R', 'C', 'I'].map(nextLetter), ['R', 'A', 'A/R', 'C', 'I', '']);
});

test('setCell stores one choice without touching others', () => {
  const o = setCell({ 'a': { x: 'C' } }, 'B', 'Y', 'I');
  assert.deepEqual(o, { a: { x: 'C' }, b: { y: 'I' } });
});

test('raciIssues: every step needs exactly one A and at least one R', () => {
  const r = buildRaci(description, { 'submit request': { cfo: 'A' } });
  const issues = raciIssues(r);
  assert.deepEqual(issues['Submit request'], ['manyA']);
  assert.deepEqual(issues['Archive'].sort(), ['noA', 'noR']);
  assert.equal(issues['Check supplier'], undefined);
});

test('raciCsv: header of roles, one line per step, quotes where needed', () => {
  const csv = raciCsv(buildRaci({ roles: [{ name: 'A, B' }], steps: [{ name: 'Do "it"', performer: 'A, B' }] }, {}));
  assert.equal(csv, 'Step,"A, B"\n"Do ""it""",A/R');
});

test('suggestionToOverrides keeps only known steps, roles and letters', () => {
  const r = buildRaci(description, {});
  const o = suggestionToOverrides({ steps: [
    { step: 'Check supplier', cells: { CFO: 'I', 'Procurement officer': 'A/R', Ghost: 'C' } },
    { step: 'Unknown step', cells: { CFO: 'A' } },
    { step: 'Archive', cells: { Employee: 'X' } },
  ] }, r);
  assert.deepEqual(o, { 'check supplier': { cfo: 'I', 'procurement officer': 'A/R' } });
});
