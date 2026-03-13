/**
 * Exports a ProjectPlan to vimpl-saas via the atomic POST /api/v1/boards/import endpoint.
 *
 * @param {object} projectPlan  - ProjectPlan object from generateProjectPlan()
 * @param {string} processName  - Fallback board title when plan_name is absent
 * @param {{ baseUrl: string, token: string }} config
 * @param {Array} selectedImprovements - Improvements from the improve panel (with effort_score/impact_score)
 * @returns {{ boardId, boardUrl, sectionId, tasksCreated }}
 */
export async function exportToVimpl(projectPlan, processName, config, selectedImprovements = []) {
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
      tracks: projectPlan.tracks ?? [],
      tasks: projectPlan.tasks ?? [],
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
