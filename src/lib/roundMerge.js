// Combine several people's versions of one process (AS-IS round submissions) into one
// Review-pane description, and list where the versions disagree.
//
// Pure: no React, no network. The only AI step — deciding which steps across versions
// are the same step — happens elsewhere (matchRoundSteps); its output is repaired here
// by validateGroups so every step appears exactly once.
//
// Disagreements: a step some versions have and others lack ('missing'), two steps in
// opposite order ('order'), and different performers for a step ('performer').
// The draft follows the majority; ties follow the preferred version (the owner's own if
// selected, otherwise the earliest submitted).

// ── Versions and step references ─────────────────────────────────────────────

export function versionsFromRound(round, submissionIds, ownerEmail) {
  const wanted = new Set(submissionIds);
  const owner = (ownerEmail || '').trim().toLowerCase();
  return (round?.submissions || [])
    .filter(s => wanted.has(s.id) && s.status === 'submitted' && s.contribution?.description)
    .map(s => ({
      id: s.id,
      name: s.participantName || s.participantEmail,
      isOwner: !!owner && (s.participantEmail || '').trim().toLowerCase() === owner,
      submittedAt: s.submittedAt,
      description: s.contribution.description,
      transcript: s.contribution.transcript || '',
    }))
    .sort((a, b) => (b.isOwner - a.isOwner) || String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

export function stepRefs(versions) {
  return versions.flatMap((v, i) => (v.description?.steps || []).map((s, j) => ({
    ref: `v${i}s${j}`,
    versionId: v.id,
    index: j,
    name: s.name || '',
    performer: s.performer || '',
    description: s.description || '',
  })));
}

/** Repair the AI's grouping: unknown refs dropped, duplicates kept once, missing refs become their own group. */
export function validateGroups(raw, refs) {
  const byRef = new Map(refs.map(r => [r.ref, r]));
  const used = new Set();
  const groups = [];
  for (const g of Array.isArray(raw) ? raw : []) {
    const members = (Array.isArray(g?.refs) ? g.refs : []).filter(r => byRef.has(r) && !used.has(r));
    if (!members.length) continue;
    members.forEach(r => used.add(r));
    const name = typeof g.name === 'string' && g.name.trim() ? g.name.trim() : byRef.get(members[0]).name;
    groups.push({ name, refs: members });
  }
  for (const r of refs) {
    if (!used.has(r.ref)) groups.push({ name: r.name, refs: [r.ref] });
  }
  return groups.map((g, i) => ({ key: `g${i}`, ...g }));
}

/**
 * True when the AI's grouping matched almost nothing across versions (e.g. it returned []).
 * Combining such a grouping gives an empty draft full of "missing" points, so callers
 * treat it as a failed comparison instead.
 */
export function groupingLooksBroken(groups, refs) {
  const versionsOf = new Map(refs.map(r => [r.ref, r.versionId]));
  if (new Set(refs.map(r => r.versionId)).size < 2) return false;
  const matched = groups
    .filter(g => new Set(g.refs.map(r => versionsOf.get(r))).size >= 2)
    .reduce((n, g) => n + g.refs.length, 0);
  return matched < refs.length / 2;
}

// ── Source passages ──────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'then', 'with', 'from', 'that', 'this', 'they', 'them', 'when', 'into', 'have', 'will', 'there', 'their', 'what', 'which', 'against', 'about', 'some', 'also',
  'og', 'der', 'det', 'den', 'som', 'med', 'til', 'fra', 'eller', 'hvis', 'når', 'skal', 'kan', 'vil', 'har', 'bliver', 'efter', 'også', 'deres', 'hvad', 'hvor',
]);
const INTERVIEWER = /^\s*(interviewer|ailean|interviewer \(ailean\))\s*:/i;
const SPEAKER = /^\s*[^\s:][^:\n]{0,30}:\s*/;

function terms(text) {
  return [...new Set((text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4 && !STOPWORDS.has(w)))];
}

/**
 * The paragraph of the participant's own words that best matches the text, copied
 * verbatim (speaker prefix removed). Null when nothing matches well. Never AI-written.
 */
export function findPassage(transcript, text) {
  const wanted = terms(text).map(t => (t.length > 5 ? t.slice(0, 5) : t));
  if (!transcript || !wanted.length) return null;
  // Scored per sentence, so a long paragraph yields the sentence that matched, not its opening
  let best = null, bestScore = 0;
  for (const para of transcript.split(/\n+/)) {
    if (!para.trim() || INTERVIEWER.test(para)) continue;
    const clean = para.replace(SPEAKER, '').trim();
    for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
      const words = sentence.toLowerCase().split(/[^\p{L}\p{N}]+/u);
      const score = wanted.filter(t => words.some(w => w.startsWith(t))).length;
      if (score > bestScore) { bestScore = score; best = sentence.trim(); }
    }
  }
  if (bestScore < Math.min(2, wanted.length)) return null;
  return best.length > 300 ? `${best.slice(0, 300).trimEnd()}…` : best;
}

export function combinedTranscript(versions) {
  return versions.map(v => `=== ${v.name} ===\n${v.transcript || ''}`.trimEnd()).join('\n\n');
}

// ── Combining ────────────────────────────────────────────────────────────────

const norm = s => (s || '').trim().toLowerCase();

function unionBy(lists, keyOf) {
  const seen = new Set();
  const out = [];
  for (const item of lists.flat()) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

// Times, decision rule and rework loop a step can carry (see stepFacts.js)
const FACT_KEYS = ['touch_time', 'wait_time', 'decision', 'rework'];

export function combine(versions, groups, processName) {
  const n = versions.length;
  const refs = stepRefs(versions);
  const byRef = new Map(refs.map(r => [r.ref, r]));
  const vIndex = new Map(versions.map((v, i) => [v.id, i]));
  const stepCount = versions.map(v => (v.description?.steps || []).length);

  // Per group: which versions have it, where, and their own step (first member)
  const info = groups.map(g => {
    const members = g.refs.map(r => byRef.get(r));
    const perVersion = new Map();
    for (const m of members) {
      const cur = perVersion.get(m.versionId);
      if (!cur || m.index < cur.index) perVersion.set(m.versionId, m);
    }
    const present = versions.filter(v => perVersion.has(v.id)).map(v => v.id);
    const rank = present.reduce((s, id) => {
      const len = stepCount[vIndex.get(id)];
      return s + (len > 1 ? perVersion.get(id).index / (len - 1) : 0);
    }, 0) / present.length;
    return { ...g, perVersion, present, rank };
  });

  // Draft order: average relative position; ties by the preferred version's position
  const order = [...info].sort((a, b) => (a.rank - b.rank)
    || ((a.perVersion.get(versions[0]?.id)?.index ?? 1e9) - (b.perVersion.get(versions[0]?.id)?.index ?? 1e9)));

  const preferred = g => versions.find(v => g.perVersion.has(v.id));
  const sourceFor = (g, v, extraText = '') => {
    const m = g.perVersion.get(v.id);
    const stepText = [m.name, m.description].filter(Boolean).join(' — ');
    return { stepText, passage: findPassage(v.transcript, `${m.name} ${m.description} ${extraText}`) };
  };
  const sourcesFor = (g, ids, extraGroup) => Object.fromEntries(ids.map(id => {
    const v = versions[vIndex.get(id)];
    const extra = extraGroup ? `${extraGroup.perVersion.get(id)?.name || ''}` : '';
    return [id, sourceFor(g, v, extra)];
  }));

  const disagreements = [];
  const steps = [];

  for (const g of order) {
    const pref = preferred(g);
    const own = g.perVersion.get(pref.id);

    // Performer: majority, ties follow the earliest version in preference order
    // Blank performers do not vote: someone who did not name a performer does not disagree
    const byPerformer = new Map();
    for (const id of g.present) {
      const p = g.perVersion.get(id).performer;
      const k = norm(p);
      if (!k) continue;
      if (!byPerformer.has(k)) byPerformer.set(k, { label: p, versionIds: [] });
      byPerformer.get(k).versionIds.push(id);
    }
    const performerOptions = [...byPerformer.values()]
      .sort((a, b) => (b.versionIds.length - a.versionIds.length) || (vIndex.get(a.versionIds[0]) - vIndex.get(b.versionIds[0])))
      .map((o, i) => ({ key: `p${i}`, ...o }));
    const performer = performerOptions[0]?.label || '';

    const ownStep = pref.description?.steps?.[own.index] || {};
    const facts = Object.fromEntries(FACT_KEYS.filter(k => ownStep[k]).map(k => [k, ownStep[k]]));
    const step = { order: 0, name: g.name, performer, description: own.description, ...facts, _key: g.key };

    // Present in a majority, or exactly half including the preferred version
    const include = g.present.length * 2 > n || (g.present.length * 2 === n && g.perVersion.has(versions[0].id));
    if (include) steps.push(step);

    if (g.present.length < n) {
      const before = order.slice(0, order.indexOf(g)).map(x => x.key);
      disagreements.push({
        id: `missing:${g.key}`,
        type: 'missing',
        key: g.key,
        stepName: g.name,
        step: { name: g.name, performer, description: own.description, ...facts },
        afterKeys: before,
        options: [
          { key: 'include', label: 'include', versionIds: g.present },
          { key: 'exclude', label: 'exclude', versionIds: versions.filter(v => !g.perVersion.has(v.id)).map(v => v.id) },
        ],
        chosen: include ? 'include' : 'exclude',
        sources: sourcesFor(g, g.present),
      });
    }

    if (performerOptions.length > 1) {
      disagreements.push({
        id: `performer:${g.key}`,
        type: 'performer',
        key: g.key,
        stepName: g.name,
        options: performerOptions,
        chosen: 'p0',
        sources: sourcesFor(g, g.present),
      });
    }
  }

  // Order: neighbouring steps (in draft order) that two or more versions both have
  const shared = order.filter(g => g.present.length >= 2);
  for (let i = 1; i < shared.length; i++) {
    const a = shared[i - 1], b = shared[i];
    const both = versions.filter(v => a.perVersion.has(v.id) && b.perVersion.has(v.id)).map(v => v.id);
    const ab = both.filter(id => a.perVersion.get(id).index < b.perVersion.get(id).index);
    const ba = both.filter(id => a.perVersion.get(id).index > b.perVersion.get(id).index);
    if (!ab.length || !ba.length) continue;
    disagreements.push({
      id: `order:${a.key}:${b.key}`,
      type: 'order',
      key: b.key,
      otherKey: a.key,
      stepName: b.name,
      otherStepName: a.name,
      options: [
        { key: 'ab', label: `${a.name} → ${b.name}`, versionIds: ab },
        { key: 'ba', label: `${b.name} → ${a.name}`, versionIds: ba },
      ],
      chosen: 'ab',
      sources: sourcesFor(b, both, a),
    });
  }

  const base = versions[0]?.description || {};
  const description = {
    ...base,
    process_name: processName || base.process_name,
    overview: base.overview || '',
    scope: base.scope || '',
    roles: unionBy(versions.map(v => v.description?.roles || []), r => norm(r?.name)),
    exceptions: unionBy(versions.map(v => v.description?.exceptions || []), norm),
    known_issues: unionBy(versions.map(v => v.description?.known_issues || []), norm),
    steps: renumber(steps),
  };
  return { description, disagreements };
}

// ── Resolving ────────────────────────────────────────────────────────────────

function renumber(steps) {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

/**
 * Settle one disagreement. optionKey null means "keep the draft as it is": the decision is
 * recorded and the description, including any edits the owner made by hand, is left alone.
 * Returns { description, snapshot }.
 */
export function resolveDisagreement(description, snapshot, disagreementId, optionKey) {
  const d = snapshot?.disagreements?.find(x => x.id === disagreementId);
  if (!d) return { description, snapshot };
  const next = optionKey == null ? description : applyResolution(description, d, optionKey);
  return {
    description: next,
    snapshot: {
      ...snapshot,
      resolutions: { ...snapshot.resolutions, [d.id]: { option: optionKey ?? 'kept', at: new Date().toISOString() } },
    },
  };
}

/** Apply the owner's choice to the current description. Acts on steps by key, so other edits survive. */
export function applyResolution(description, d, optionKey) {
  const steps = [...(description?.steps || [])];
  const at = key => steps.findIndex(s => s._key === key);

  if (d.type === 'missing') {
    const i = at(d.key);
    if (optionKey === 'exclude') {
      if (i < 0) return description;
      steps.splice(i, 1);
    } else {
      if (i >= 0) return description;
      // After the latest-placed of the steps that come before it in the draft
      const anchor = Math.max(-1, ...d.afterKeys.map(at));
      steps.splice(anchor + 1, 0, { order: 0, ...d.step, _key: d.key });
    }
    return { ...description, steps: renumber(steps) };
  }

  if (d.type === 'performer') {
    const i = at(d.key);
    const opt = d.options.find(o => o.key === optionKey);
    if (i < 0 || !opt) return description;
    steps[i] = { ...steps[i], performer: opt.label };
    return { ...description, steps };
  }

  if (d.type === 'order') {
    const ia = at(d.otherKey), ib = at(d.key);
    if (ia < 0 || ib < 0) return description;
    if (optionKey === 'ab' && ib < ia) {
      const [b] = steps.splice(ib, 1);
      steps.splice(at(d.otherKey) + 1, 0, b);
    } else if (optionKey === 'ba' && ia < ib) {
      const [b] = steps.splice(ib, 1);
      steps.splice(at(d.otherKey), 0, b);
    } else {
      return description;
    }
    return { ...description, steps: renumber(steps) };
  }
  return description;
}
