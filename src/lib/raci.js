// RACI chart from a process description: one row per step, one column per role.
// The step's performer is Accountable and Responsible (A/R) by default; the owner's
// choices are stored as overrides keyed by lower-cased step and role names, so they
// survive steps being renumbered. Pure functions, no React.

export const LETTERS = ['', 'R', 'A', 'A/R', 'C', 'I'];
const key = s => (s || '').trim().toLowerCase();

export function nextLetter(letter) {
  const i = LETTERS.indexOf(letter);
  return LETTERS[(i + 1) % LETTERS.length];
}

export function buildRaci(description, overrides = {}) {
  const roles = [];
  const add = name => {
    const n = (name || '').trim();
    if (n && !roles.some(r => key(r) === key(n))) roles.push(n);
  };
  (description?.roles || []).forEach(r => add(r?.name));
  (description?.steps || []).forEach(s => add(s?.performer));

  const rows = (description?.steps || []).map(s => {
    const saved = overrides?.[key(s.name)] || {};
    const cells = {};
    for (const role of roles) {
      const fallback = key(role) === key(s.performer) ? 'A/R' : '';
      cells[role] = key(role) in saved ? saved[key(role)] : fallback;
    }
    return { step: s.name, cells };
  });
  return { roles, rows };
}

export function setCell(overrides, step, role, letter) {
  const s = key(step);
  return { ...overrides, [s]: { ...(overrides?.[s] || {}), [key(role)]: letter } };
}

/** Per step: 'noA' (no one accountable), 'manyA' (more than one), 'noR' (nobody does it). */
export function raciIssues(raci) {
  const out = {};
  for (const row of raci.rows) {
    const v = Object.values(row.cells);
    const a = v.filter(x => x === 'A' || x === 'A/R').length;
    const r = v.filter(x => x === 'R' || x === 'A/R').length;
    const issues = [];
    if (a === 0) issues.push('noA');
    if (a > 1) issues.push('manyA');
    if (r === 0) issues.push('noR');
    if (issues.length) out[row.step] = issues;
  }
  return out;
}

const csvCell = v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function raciCsv(raci, stepLabel = 'Step') {
  return [
    [stepLabel, ...raci.roles].map(csvCell).join(','),
    ...raci.rows.map(r => [r.step, ...raci.roles.map(role => r.cells[role])].map(csvCell).join(',')),
  ].join('\n');
}

/** The AI's suggestion as overrides, dropping anything that does not match a step, a role or a letter. */
export function suggestionToOverrides(suggestion, raci) {
  const steps = new Set(raci.rows.map(r => key(r.step)));
  const roles = new Set(raci.roles.map(key));
  const out = {};
  for (const s of suggestion?.steps || []) {
    const sk = key(s?.step);
    if (!steps.has(sk)) continue;
    for (const [role, letter] of Object.entries(s.cells || {})) {
      if (!roles.has(key(role)) || !LETTERS.includes(letter)) continue;
      (out[sk] ||= {})[key(role)] = letter;
    }
  }
  return out;
}
