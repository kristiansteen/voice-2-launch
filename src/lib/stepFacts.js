// Facts a description step can carry beyond name, performer and text: touch time, waiting
// time, a decision rule and a rework loop. All optional: a fact nobody stated stays out,
// it is never guessed. These helpers clean what the AI returns and format it for people.

const UNIT_ALIASES = {
  min: 'min', mins: 'min', minute: 'min', minutes: 'min',
  hr: 'hr', hrs: 'hr', hour: 'hr', hours: 'hr', h: 'hr',
  day: 'day', days: 'day', d: 'day',
  week: 'week', weeks: 'week', w: 'week',
};
const MINUTES = { min: 1, hr: 60, day: 1440, week: 10080 };
const FACT_KEYS = ['touch_time', 'wait_time', 'decision', 'rework'];

const text = v => (typeof v === 'string' ? v.trim() : '');

export function cleanTime(t) {
  if (!t || typeof t !== 'object') return null;
  const value = Number(t.value);
  const unit = UNIT_ALIASES[String(t.unit || '').toLowerCase()];
  if (!Number.isFinite(value) || value <= 0 || !unit) return null;
  return { value, unit, source: t.source === 'measured' ? 'measured' : 'estimated' };
}

export function cleanDecision(d) {
  if (!d || typeof d !== 'object') return null;
  const question = text(d.question);
  const outcomes = (Array.isArray(d.outcomes) ? d.outcomes : [])
    .map(o => ({ condition: text(o?.condition), next: text(o?.next) }))
    .filter(o => o.condition);
  return question && outcomes.length >= 2 ? { question, outcomes } : null;
}

export function cleanRework(r) {
  if (!r || typeof r !== 'object') return null;
  const back_to = text(r.back_to);
  return back_to ? { back_to, when: text(r.when) } : null;
}

export function cleanStep(step) {
  const out = { ...step };
  for (const k of FACT_KEYS) delete out[k];
  const facts = {
    touch_time: cleanTime(step?.touch_time),
    wait_time: cleanTime(step?.wait_time),
    decision: cleanDecision(step?.decision),
    rework: cleanRework(step?.rework),
  };
  for (const [k, v] of Object.entries(facts)) if (v) out[k] = v;
  return out;
}

export function cleanDescription(description) {
  if (!description || typeof description !== 'object') return description ?? null;
  return { ...description, steps: (description.steps || []).map(cleanStep) };
}

export const toMinutes = t => (t ? t.value * MINUTES[t.unit] : null);

const NAMES = {
  en: { min: ['min', 'min'], hr: ['hr', 'hrs'], day: ['day', 'days'], week: ['week', 'weeks'] },
  da: { min: ['min', 'min'], hr: ['time', 'timer'], day: ['dag', 'dage'], week: ['uge', 'uger'] },
};

/** "10 min", "~2 days" (the ~ marks an estimate). */
export function formatTime(t, lang = 'en') {
  if (!t) return '';
  const [one, many] = (NAMES[lang] || NAMES.en)[t.unit];
  return `${t.source === 'estimated' ? '~' : ''}${t.value} ${t.value === 1 ? one : many}`;
}
