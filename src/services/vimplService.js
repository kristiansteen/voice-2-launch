// ── Past-tense helper for task titles ────────────────────────────────────────
const IRREGULAR = {
  build: 'Built', built: 'Built',
  run: 'Run',
  set: 'Set',
  input: 'Input',
  output: 'Output',
  cut: 'Cut',
  put: 'Put',
  let: 'Let',
  cost: 'Cost',
  test: 'Tested',    // regular but easy to handle
};

const DOUBLE_CONSONANT = /^(plan|stop|drop|map|wrap|run|begin|commit|embed|submit)$/i;

function verbToPast(verb) {
  const lower = verb.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  // Already past tense (ends in -ed)?
  if (lower.endsWith('ed')) return verb;
  // -e endings: remove e, add -ed  (configure → configured, analyse → analysed)
  if (lower.endsWith('e')) return verb.slice(0, -1) + 'ed';
  // -y endings: consonant + y → -ied (identify → identified)
  if (lower.endsWith('y') && !/[aeiou]/.test(lower[lower.length - 2])) return verb.slice(0, -1) + 'ied';
  // Double final consonant for short verbs (plan → planned)
  if (DOUBLE_CONSONANT.test(lower)) return verb + verb.slice(-1) + 'ed';
  // Default: add -ed
  return verb + 'ed';
}

function taskTitleToPast(title) {
  if (!title) return title;
  const words = title.split(' ');
  // Capitalise first letter of converted verb, keep rest of title
  words[0] = verbToPast(words[0]);
  // Ensure first char is uppercase
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

/**
 * Exports a ProjectPlan to vimpl-saas via the atomic POST /api/v1/boards/import endpoint.
 *
 * @param {object} projectPlan  - ProjectPlan object from generateProjectPlan()
 * @param {string} processName  - Fallback board title when plan_name is absent
 * @param {{ baseUrl: string, token: string }} config
 * @param {Array} selectedImprovements - Improvements from the improve panel (with effort_score/impact_score)
 * @returns {{ boardId, boardUrl, sectionId, tasksCreated }}
 */
export async function exportToVimpl(projectPlan, processName, config, selectedImprovements = [], processDescription = null) {
  const { baseUrl, token } = config;

  const res = await fetch(`${baseUrl}/api/v1/boards/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plan_name: projectPlan.plan_name || processName,
      process_name: processName,
      duration_weeks: projectPlan.duration_weeks ?? 14,
      overview: processDescription?.overview || '',
      scope: processDescription?.scope || '',
      tracks: projectPlan.tracks ?? [],
      tasks: (projectPlan.tasks ?? []).map(t => ({ ...t, title: taskTitleToPast(t.title) })),
      risks: projectPlan.risks ?? [],
      improvements: selectedImprovements,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message || `Import failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    boardId: data.boardId,
    boardUrl: data.boardUrl,
    sectionId: data.sectionId,
    tasksCreated: data.tasksCreated,
  };
}
