import { ganttLayout } from '../lib/gantt.js';

// Week-based Gantt chart of the project plan: tracks as groups, tasks as bars.
export default function PlanGantt({ plan, t }) {
  const { weeks, groups } = ganttLayout(plan);
  if (!groups.length) return null;

  const grid = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / weeks}% - 1px), #E2E2DD calc(${100 / weeks}% - 1px), #E2E2DD ${100 / weeks}%)`,
  };
  const weekNums = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <div className="px-4 pt-4 pb-2" data-testid="plan-gantt">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.planTimeline}</p>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3">
        <div className="text-[10px] text-mid text-right self-end pb-1 border-b border-ink">{t.week}</div>
        <div className="flex text-[10px] text-mid tabular-nums border-b border-ink pb-1">
          {weekNums.map(w => (
            <span key={w} className="flex-1 text-center">{w}</span>
          ))}
        </div>

        {groups.map((g, gi) => (
          <div key={g.id} className="contents">
            {g.name && (
              <p className={`col-span-2 text-[11px] font-semibold text-ink uppercase tracking-wide ${gi ? 'pt-3' : 'pt-2'} pb-1`}>{g.name}</p>
            )}
            {g.tasks.map(task => (
              <div key={task.id} className="contents">
                <div className="py-1.5 min-w-0 border-b border-gray-50">
                  <p className="text-xs text-gray-700 truncate" title={task.title}>{task.title}</p>
                  {task.owner && <p className="text-[11px] text-mid truncate">{task.owner}</p>}
                </div>
                <div className="relative border-b border-gray-50" style={grid}>
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-[3px] ${gi % 2 ? 'bg-signal' : 'bg-ink'}`}
                    style={{ left: `${task.leftPct}%`, width: `${task.widthPct}%` }}
                    title={`${t.week} ${task.start}–${task.end}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
