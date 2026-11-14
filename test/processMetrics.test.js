import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toMinutes, formatMinutes, normaliseMetrics, expectedVisits, processTimes,
  gatewayBranches, updateActivityMetric, updateGatewayBranch, compareTimes,
} from '../src/lib/processMetrics.js';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ''} expected ${b}, got ${a}`);

// start → A → gw ─(Yes 75%)→ B → end
//                └(No 25%)──→ C → end
const BRANCH = {
  events: [{ id: 'event_1', type: 'start' }, { id: 'event_2', type: 'end' }],
  activities: [{ id: 'act_a' }, { id: 'act_b' }, { id: 'act_c' }],
  gateways: [{ id: 'gw_1', type: 'exclusive' }],
  sequence_flows: [
    { id: 'f1', from: 'event_1', to: 'act_a' },
    { id: 'f2', from: 'act_a', to: 'gw_1' },
    { id: 'f3', from: 'gw_1', to: 'act_b', condition: 'Yes' },
    { id: 'f4', from: 'gw_1', to: 'act_c', condition: 'No' },
    { id: 'f5', from: 'act_b', to: 'event_2' },
    { id: 'f6', from: 'act_c', to: 'event_2' },
  ],
};
const BRANCH_METRICS = {
  activities: [
    { id: 'act_a', duration_value: 10, duration_unit: 'min' },
    { id: 'act_b', duration_value: 20, duration_unit: 'min' },
    { id: 'act_c', duration_value: 2, duration_unit: 'hr' },
  ],
  gateways: [{ id: 'gw_1', branches: [{ condition: 'Yes', rate: 75 }, { condition: 'No', rate: 25 }] }],
};

// start → A → B → gw ─(OK 80%)→ end
//         ↑         └(Rework 20%)┘ back to A
const LOOP = {
  events: [{ id: 'event_1', type: 'start' }, { id: 'event_2', type: 'end' }],
  activities: [{ id: 'act_a' }, { id: 'act_b' }],
  gateways: [{ id: 'gw_1', type: 'exclusive' }],
  sequence_flows: [
    { id: 'f1', from: 'event_1', to: 'act_a' },
    { id: 'f2', from: 'act_a', to: 'act_b' },
    { id: 'f3', from: 'act_b', to: 'gw_1' },
    { id: 'f4', from: 'gw_1', to: 'event_2', condition: 'OK' },
    { id: 'f5', from: 'gw_1', to: 'act_a', condition: 'Rework' },
  ],
};
const LOOP_METRICS = {
  activities: [
    { id: 'act_a', duration_value: 30, duration_unit: 'min' },
    { id: 'act_b', duration_value: 10, duration_unit: 'min' },
  ],
  gateways: [{ id: 'gw_1', branches: [{ condition: 'OK', rate: 80 }, { condition: 'Rework', rate: 20 }] }],
};

test('toMinutes converts working-time units', () => {
  assert.equal(toMinutes(30, 'min'), 30);
  assert.equal(toMinutes(2, 'hr'), 120);
  assert.equal(toMinutes(1, 'day'), 480);
  assert.equal(toMinutes(1, 'week'), 2400);
});

test('formatMinutes picks a readable unit', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(150), '2.5 hr');
  assert.equal(formatMinutes(480 * 3), '3 days');
});

test('normaliseMetrics', async (t) => {
  await t.test('values without a source count as estimated', () => {
    const m = normaliseMetrics(BRANCH_METRICS);
    assert.equal(m.activities[0].duration_source, 'estimated');
    assert.equal(m.gateways[0].branches[0].source, 'estimated');
  });
  await t.test('keeps a valid source and rejects an unknown one', () => {
    const m = normaliseMetrics({ activities: [
      { id: 'a', duration_value: 5, duration_unit: 'min', duration_source: 'stated' },
      { id: 'b', duration_value: 5, duration_unit: 'min', duration_source: 'guessed' },
    ] });
    assert.equal(m.activities[0].duration_source, 'stated');
    assert.equal(m.activities[1].duration_source, 'estimated');
  });
  await t.test('the AI can never mark a value as measured', () => {
    const m = normaliseMetrics({ activities: [{ id: 'a', duration_value: 5, duration_unit: 'min', duration_source: 'measured' }] }, { fromAi: true });
    assert.equal(m.activities[0].duration_source, 'estimated');
  });
  await t.test('forceSource overrides everything (TO-BE projections)', () => {
    const m = normaliseMetrics({
      activities: [{ id: 'a', duration_value: 5, duration_unit: 'min', duration_source: 'stated', wait_value: 1, wait_unit: 'day', wait_source: 'stated' }],
      gateways: [{ id: 'g', branches: [{ condition: 'x', rate: 100, source: 'stated' }] }],
    }, { forceSource: 'estimated' });
    assert.equal(m.activities[0].duration_source, 'estimated');
    assert.equal(m.activities[0].wait_source, 'estimated');
    assert.equal(m.gateways[0].branches[0].source, 'estimated');
  });
  await t.test('a missing waiting time stays unknown rather than becoming zero', () => {
    const m = normaliseMetrics(BRANCH_METRICS);
    assert.equal(m.activities[0].wait_value, undefined);
    assert.equal(m.activities[0].wait_source, undefined);
  });
  await t.test('returns null for null', () => {
    assert.equal(normaliseMetrics(null), null);
  });
});

test('expectedVisits', async (t) => {
  await t.test('exclusive branches are visited in proportion to their rates', () => {
    const v = expectedVisits(BRANCH, BRANCH_METRICS);
    close(v.act_a, 1); close(v.act_b, 0.75); close(v.act_c, 0.25); close(v.event_2, 1);
  });
  await t.test('a 20% rework loop means each looped step runs 1.25 times', () => {
    const v = expectedVisits(LOOP, LOOP_METRICS);
    close(v.act_a, 1.25); close(v.act_b, 1.25); close(v.event_2, 1);
  });
  await t.test('branches without rates are split equally', () => {
    const v = expectedVisits(BRANCH, { activities: [] });
    close(v.act_b, 0.5); close(v.act_c, 0.5);
  });
  await t.test('rates that do not sum to 100 are scaled', () => {
    const v = expectedVisits(BRANCH, { gateways: [{ id: 'gw_1', branches: [{ condition: 'Yes', rate: 60 }, { condition: 'No', rate: 20 }] }] });
    close(v.act_b, 0.75); close(v.act_c, 0.25);
  });
  await t.test('parallel gateways send the case down every branch', () => {
    const par = { ...BRANCH, gateways: [{ id: 'gw_1', type: 'parallel' }] };
    const v = expectedVisits(par, BRANCH_METRICS);
    close(v.act_b, 1); close(v.act_c, 1);
  });
  await t.test('a loop with no way out returns null instead of infinity', () => {
    const stuck = { ...LOOP, sequence_flows: LOOP.sequence_flows.filter(f => f.id !== 'f4') };
    assert.equal(expectedVisits(stuck, { activities: [] }), null);
  });
});

test('processTimes', async (t) => {
  await t.test('touch time is weighted by branch rates, not a plain sum', () => {
    const r = processTimes(BRANCH, BRANCH_METRICS);
    close(r.touchMin, 10 + 0.75 * 20 + 0.25 * 120); // 55, not 150
    assert.equal(r.weighted, true);
  });
  await t.test('rework multiplies the time of the looped steps', () => {
    close(processTimes(LOOP, LOOP_METRICS).touchMin, 1.25 * 40);
  });
  await t.test('lead time = touch + waiting, and flow efficiency = touch / lead', () => {
    const m = { ...BRANCH_METRICS, activities: BRANCH_METRICS.activities.map(a => ({ ...a, wait_value: 1, wait_unit: 'hr' })) };
    const r = processTimes(BRANCH, m);
    close(r.waitMin, 60 + 0.75 * 60 + 0.25 * 60);
    close(r.leadMin, 55 + 120);
    close(r.flowEfficiency, 55 / 175);
    assert.equal(r.waitComplete, true);
  });
  await t.test('lead time is not reported while any waiting time is unknown', () => {
    const m = { ...BRANCH_METRICS, activities: BRANCH_METRICS.activities.map((a, i) => (i === 0 ? { ...a, wait_value: 1, wait_unit: 'hr' } : a)) };
    const r = processTimes(BRANCH, m);
    assert.equal(r.waitComplete, false);
    assert.equal(r.leadMin, null);
    assert.equal(r.flowEfficiency, null);
  });
  await t.test('counts how many inputs are stated, estimated and measured', () => {
    const m = {
      activities: [
        { id: 'act_a', duration_value: 10, duration_unit: 'min', duration_source: 'stated', wait_value: 2, wait_unit: 'hr', wait_source: 'measured' },
        { id: 'act_b', duration_value: 20, duration_unit: 'min' },
        { id: 'act_c', duration_value: 2, duration_unit: 'hr' },
      ],
      gateways: [{ id: 'gw_1', branches: [{ condition: 'Yes', rate: 75, source: 'stated' }, { condition: 'No', rate: 25, source: 'stated' }] }],
    };
    const r = processTimes(BRANCH, m);
    assert.deepEqual(r.sources, { stated: 3, estimated: 2, measured: 1 });
    assert.equal(r.total, 6);
  });
  await t.test('falls back to a plain sum, flagged as unweighted, when the flow cannot be solved', () => {
    const stuck = { ...LOOP, sequence_flows: LOOP.sequence_flows.filter(f => f.id !== 'f4') };
    const r = processTimes(stuck, LOOP_METRICS);
    close(r.touchMin, 40);
    assert.equal(r.weighted, false);
  });
  await t.test('returns null without metrics', () => {
    assert.equal(processTimes(BRANCH, null), null);
  });
});

test('gatewayBranches lists every outgoing flow with its rate and source', () => {
  const b = gatewayBranches(BRANCH, { gateways: [{ id: 'gw_1', branches: [{ condition: 'Yes', rate: 75, source: 'stated' }] }] }, 'gw_1');
  assert.deepEqual(b.map(x => [x.condition, x.rate, x.source]), [['Yes', 75, 'stated'], ['No', 25, 'estimated']]);
});

test('updateActivityMetric', async (t) => {
  await t.test('a value the user overwrites is no longer an estimate', () => {
    const m = updateActivityMetric(normaliseMetrics(BRANCH_METRICS), 'act_a', { duration_value: 12 });
    assert.equal(m.activities[0].duration_value, 12);
    assert.equal(m.activities[0].duration_source, 'stated');
  });
  await t.test('editing a measured value keeps it measured', () => {
    const base = { activities: [{ id: 'a', duration_value: 5, duration_unit: 'min', duration_source: 'measured' }] };
    assert.equal(updateActivityMetric(base, 'a', { duration_value: 6 }).activities[0].duration_source, 'measured');
  });
  await t.test('the user can set the source explicitly', () => {
    const m = updateActivityMetric(normaliseMetrics(BRANCH_METRICS), 'act_a', { duration_source: 'measured' });
    assert.equal(m.activities[0].duration_source, 'measured');
    assert.equal(m.activities[0].duration_value, 10);
  });
  await t.test('adding a waiting time records it with a source', () => {
    const m = updateActivityMetric(normaliseMetrics(BRANCH_METRICS), 'act_b', { wait_value: 2, wait_unit: 'day' });
    assert.equal(m.activities[1].wait_value, 2);
    assert.equal(m.activities[1].wait_source, 'stated');
  });
  await t.test('creates the entry when the step has no metrics yet', () => {
    const m = updateActivityMetric(null, 'act_x', { duration_value: 15, duration_unit: 'min' });
    assert.deepEqual(m.activities, [{ id: 'act_x', duration_value: 15, duration_unit: 'min', duration_source: 'stated' }]);
  });
  await t.test('does not mutate its input', () => {
    const base = normaliseMetrics(BRANCH_METRICS);
    const snapshot = JSON.stringify(base);
    updateActivityMetric(base, 'act_a', { duration_value: 99 });
    assert.equal(JSON.stringify(base), snapshot);
  });
});

test('updateGatewayBranch', async (t) => {
  await t.test('overwriting a rate marks that branch as stated and keeps the others', () => {
    const m = updateGatewayBranch(normaliseMetrics(BRANCH_METRICS), BRANCH, 'gw_1', 'Yes', { rate: 90 });
    const b = m.gateways[0].branches;
    assert.deepEqual(b.map(x => [x.condition, x.rate, x.source]), [['Yes', 90, 'stated'], ['No', 25, 'estimated']]);
  });
  await t.test('creates the gateway entry from the diagram when it has no metrics yet', () => {
    const m = updateGatewayBranch({ activities: [] }, BRANCH, 'gw_1', 'No', { rate: 10 });
    assert.deepEqual(m.gateways[0].branches.map(x => [x.condition, x.rate, x.source]), [['Yes', 50, 'estimated'], ['No', 10, 'stated']]);
  });
});

test('compareTimes', async (t) => {
  const toBe = {
    ...BRANCH_METRICS,
    activities: BRANCH_METRICS.activities.map(a => (a.id === 'act_c' ? { ...a, duration_value: 1 } : a)),
  };
  await t.test('touch-time reduction uses the weighted times', () => {
    const r = compareTimes(BRANCH, BRANCH_METRICS, BRANCH, toBe);
    assert.equal(r.touchReduction, Math.round((1 - 40 / 55) * 100)); // 27, a plain sum would say 40
  });
  await t.test('lead-time reduction is only given when waiting time is known on both sides', () => {
    assert.equal(compareTimes(BRANCH, BRANCH_METRICS, BRANCH, toBe).leadReduction, null);
    const w = m => ({ ...m, activities: m.activities.map(a => ({ ...a, wait_value: 1, wait_unit: 'hr' })) });
    assert.equal(compareTimes(BRANCH, w(BRANCH_METRICS), BRANCH, w(toBe)).leadReduction, Math.round((1 - 160 / 175) * 100));
  });
  await t.test('flags the result as estimate-based when any input is an estimate', () => {
    assert.equal(compareTimes(BRANCH, BRANCH_METRICS, BRANCH, toBe).basedOnEstimates, true);
  });
  await t.test('returns null when either side has no metrics', () => {
    assert.equal(compareTimes(BRANCH, BRANCH_METRICS, BRANCH, null), null);
  });
});
