import test from 'node:test';
import assert from 'node:assert/strict';
import { ganttLayout } from '../src/lib/gantt.js';

const plan = {
  duration_weeks: 10,
  tracks: [{ id: 'a', name: 'Automation' }, { id: 'w', name: 'Ways of working' }],
  tasks: [
    { id: 't1', track_id: 'a', title: 'Supplier look-up', week_start: 1, week_end: 3, owner: 'ServiceNow team' },
    { id: 't2', track_id: 'a', title: 'SAP integration', week_start: 2, week_end: 8, owner: 'SAP team' },
    { id: 't3', track_id: 'w', title: 'Train employees', week_start: 8, week_end: 10 },
  ],
};

test('one group per track, in track order, with week columns 1..duration', () => {
  const g = ganttLayout(plan);
  assert.equal(g.weeks, 10);
  assert.deepEqual(g.groups.map(x => x.name), ['Automation', 'Ways of working']);
  assert.deepEqual(g.groups[0].tasks.map(x => x.id), ['t1', 't2']);
});

test('a bar starts at its first week and spans to the end of its last week', () => {
  const [a] = ganttLayout(plan).groups;
  const t1 = a.tasks[0], t2 = a.tasks[1];
  assert.equal(t1.leftPct, 0);
  assert.equal(t1.widthPct, 30);   // weeks 1–3 of 10
  assert.equal(t2.leftPct, 10);
  assert.equal(t2.widthPct, 70);   // weeks 2–8
  assert.equal(t1.owner, 'ServiceNow team');
});

test('the chart grows to fit a task that runs past duration_weeks', () => {
  const g = ganttLayout({ ...plan, tasks: [...plan.tasks, { id: 't4', track_id: 'w', title: 'Re-measure', week_start: 11, week_end: 12 }] });
  assert.equal(g.weeks, 12);
});

test('missing or reversed weeks still give a bar of at least one week', () => {
  const g = ganttLayout({ duration_weeks: 4, tracks: [{ id: 'a', name: 'A' }], tasks: [
    { id: 'x', track_id: 'a', title: 'No end', week_start: 2 },
    { id: 'y', track_id: 'a', title: 'Reversed', week_start: 3, week_end: 1 },
    { id: 'z', track_id: 'a', title: 'No weeks' },
  ] });
  const [x, y, z] = g.groups[0].tasks;
  assert.deepEqual([x.start, x.end], [2, 2]);
  assert.deepEqual([y.start, y.end], [1, 3]);
  assert.deepEqual([z.start, z.end], [1, 1]);
});

test('tasks whose track is unknown go in a trailing group without a name', () => {
  const g = ganttLayout({ ...plan, tasks: [...plan.tasks, { id: 'o', track_id: 'zz', title: 'Orphan', week_start: 1, week_end: 1 }] });
  const last = g.groups[g.groups.length - 1];
  assert.equal(last.name, null);
  assert.deepEqual(last.tasks.map(t => t.id), ['o']);
});

test('no tasks gives no groups', () => {
  assert.deepEqual(ganttLayout({ duration_weeks: 6, tracks: [], tasks: [] }).groups, []);
});
