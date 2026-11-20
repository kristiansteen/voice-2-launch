// Lays out a project plan as a week-based Gantt chart: one group per track,
// one bar per task, positioned as percentages of the full timeline.

function weekRange(task) {
  const s = Number.isFinite(task.week_start) && task.week_start >= 1 ? task.week_start : 1;
  const e = Number.isFinite(task.week_end) ? task.week_end : s;
  return [Math.min(s, e), Math.max(s, e)];
}

export function ganttLayout(plan) {
  const tasks = plan?.tasks || [];
  const tracks = plan?.tracks || [];
  const lastEnd = tasks.reduce((m, t) => Math.max(m, weekRange(t)[1]), 0);
  const weeks = Math.max(plan?.duration_weeks || 0, lastEnd, 1);

  const bar = t => {
    const [start, end] = weekRange(t);
    return {
      id: t.id,
      title: t.title,
      owner: t.owner || null,
      start,
      end,
      leftPct: ((start - 1) / weeks) * 100,
      widthPct: ((end - start + 1) / weeks) * 100,
    };
  };

  const known = new Set(tracks.map(tr => tr.id));
  const groups = tracks
    .map(tr => ({ id: tr.id, name: tr.name, tasks: tasks.filter(t => t.track_id === tr.id).map(bar) }))
    .filter(g => g.tasks.length);
  const orphans = tasks.filter(t => !known.has(t.track_id)).map(bar);
  if (orphans.length) groups.push({ id: '_other', name: null, tasks: orphans });

  return { weeks, groups };
}
