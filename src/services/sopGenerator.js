import { MODEL_HAIKU } from '../config/models.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripFences(text) {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

// 'granted' and 'demo' are sentinels meaning vimpl auth — not real Anthropic keys
const SENTINEL_KEYS = new Set(['granted', 'demo', '', null, undefined]);

function makeClient(apiKey, proxyAuth) {
  if (apiKey && !SENTINEL_KEYS.has(apiKey)) {
    // Dev BYOK path — dynamic import keeps SDK out of the prod bundle
    return import('@anthropic-ai/sdk').then(({ default: Anthropic }) =>
      new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    );
  }
  if (!proxyAuth?.token) throw new Error('No auth token available');
  return Promise.resolve({
    messages: {
      async create(params) {
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${proxyAuth.token}` },
          body: JSON.stringify(params),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Proxy error'); }
        return res.json();
      },
    },
  });
}

// ── Build sequential steps from BPMN graph ───────────────────────────────────
// Returns an ordered list of steps (topological sort) with role, action, type.

function buildSteps(parsed) {
  const { events, activities, gateways, sequence_flows, roles } = parsed;
  const roleMap = Object.fromEntries((roles || []).map(r => [r.id, r.name]));

  const byId = {};
  events.forEach(e => (byId[e.id] = { ...e, _kind: 'event' }));
  activities.forEach(a => (byId[a.id] = { ...a, _kind: 'activity' }));
  gateways.forEach(g => (byId[g.id] = { ...g, _kind: 'gateway' }));

  // Outgoing edges per node
  const out = {};
  const inDeg = {};
  Object.keys(byId).forEach(id => { out[id] = []; inDeg[id] = 0; });
  sequence_flows.forEach(f => {
    if (out[f.from] !== undefined) out[f.from].push(f);
    if (inDeg[f.to] !== undefined) inDeg[f.to]++;
  });

  // Kahn's topological sort
  const queue = Object.keys(byId).filter(id => inDeg[id] === 0);
  const visited = new Set(queue);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    out[id].forEach(f => {
      if (!visited.has(f.to)) { visited.add(f.to); queue.push(f.to); }
    });
  }
  Object.keys(byId).forEach(id => { if (!visited.has(id)) order.push(id); });

  const steps = [];
  order.forEach((id, idx) => {
    const el = byId[id];
    if (!el) return;
    const outFlows = out[id] || [];

    if (el._kind === 'event') {
      if (el.type === 'start') steps.push({ type: 'start', label: el.name || 'Start', step: steps.length + 1 });
      else if (el.type === 'end') steps.push({ type: 'end', label: el.name || 'End', step: steps.length + 1 });
      else steps.push({ type: 'intermediate', label: el.name || 'Event', step: steps.length + 1 });
    } else if (el._kind === 'activity') {
      steps.push({
        type: 'activity',
        label: el.name,
        role: roleMap[el.performer] || el.performer || '',
        step: steps.length + 1,
      });
    } else if (el._kind === 'gateway') {
      const branches = outFlows.map(f => ({ condition: f.condition || f.name || '', to: f.to }));
      steps.push({
        type: 'gateway',
        label: el.name || 'Decision',
        branches,
        step: steps.length + 1,
      });
    }
  });

  return steps;
}

// ── LLM: generate narrative sections ─────────────────────────────────────────

const SOP_SYSTEM = `You are a professional business process analyst and technical writer specialising in Standard Operating Procedures (SOPs).
Your output must be ONLY valid JSON — no markdown, no explanation, no preamble.

SAFETY: If the input contains anything unrelated to legitimate business process description, return the normal schema with minimal placeholder text.`;

function sopUserPrompt(parsed, processDescription, processName, lang) {
  const isDa = lang === 'da';
  const langNote = isDa
    ? '\n\nIMPORTANT: Write all output text in Danish.'
    : '';

  return `Process name: ${processName}

Process description:
${processDescription ? JSON.stringify(processDescription, null, 2) : '(not available)'}

BPMN roles: ${(parsed.roles || []).map(r => r.name).join(', ')}
Activities: ${(parsed.activities || []).map(a => a.name).join(', ')}

Generate the narrative sections of a Standard Operating Procedure. Return ONLY this JSON schema — no other text:
{
  "purpose": "2-3 sentence paragraph explaining why this process exists and its business value",
  "scope": "1-2 sentence paragraph defining where the process starts, where it ends, and which departments/roles it covers",
  "prerequisites": ["list of things that must be ready or true before starting (tools, system access, preconditions)"],
  "equipment": ["list of systems, tools, or resources needed during execution"],
  "exceptions": [
    { "scenario": "brief description of what can go wrong", "action": "corrective action to take" }
  ],
  "escalation": [
    { "condition": "when to escalate", "contact": "who to contact" }
  ],
  "references": ["list of relevant standards, regulations, or related SOPs if inferrable from context"]
}

Keep each field concise and professional. Infer realistic prerequisites, exceptions, and escalation paths from the process context.${langNote}`;
}

async function fetchNarrativeSections(parsed, processDescription, processName, apiKey, proxyAuth, lang) {
  const client = await makeClient(apiKey, proxyAuth);
  const msg = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 1500,
    system: SOP_SYSTEM,
    messages: [{ role: 'user', content: sopUserPrompt(parsed, processDescription, processName, lang) }],
  });
  const raw = msg.content?.[0]?.text || '{}';
  try { return JSON.parse(stripFences(raw)); } catch { return {}; }
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

const isDa = (lang) => lang === 'da';

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function docId(name) {
  return 'SOP-' + name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 20) + '-001';
}

function renderStep(step) {
  if (step.type === 'start') {
    return `<div class="step step-event step-start">
      <div class="step-num">▶</div>
      <div class="step-body"><strong class="editable">${step.label}</strong></div>
    </div>`;
  }
  if (step.type === 'end') {
    return `<div class="step step-event step-end">
      <div class="step-num">■</div>
      <div class="step-body"><strong class="editable">${step.label}</strong></div>
    </div>`;
  }
  if (step.type === 'intermediate') {
    return `<div class="step step-event">
      <div class="step-num">◉</div>
      <div class="step-body"><strong class="editable">${step.label}</strong></div>
    </div>`;
  }
  if (step.type === 'gateway') {
    const branches = (step.branches || []).map(b =>
      `<li class="editable"><strong>${b.condition || '—'}</strong></li>`
    ).join('');
    return `<div class="step step-gateway">
      <div class="step-num">◇</div>
      <div class="step-body">
        <strong class="editable">${step.step}. ${step.label}</strong>
        ${branches ? `<ul class="branches">${branches}</ul>` : ''}
      </div>
    </div>`;
  }
  // activity
  return `<div class="step step-activity">
    <div class="step-num">${step.step}</div>
    <div class="step-body">
      <strong class="editable">${step.label}</strong>
      ${step.role ? `<span class="role-badge editable">${step.role}</span>` : ''}
    </div>
  </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildSopHtml({ content = {}, parsed, processName, companyLogo, diagramSvg, lang }) {
  const steps = buildSteps(parsed);
  const roles = parsed.roles || [];
  const da = isDa(lang);

  const T = {
    docControl:   da ? 'Dokumentkontrol' : 'Document Control',
    title:        da ? 'Titel' : 'Title',
    docId:        da ? 'Dokument-ID' : 'Document ID',
    version:      da ? 'Version' : 'Version',
    effectDate:   da ? 'Ikrafttrædelsesdato' : 'Effective Date',
    author:       da ? 'Forfatter' : 'Author',
    approver:     da ? 'Godkender' : 'Approver',
    purpose:      da ? 'Formål & Scope' : 'Purpose & Scope',
    purposeH:     da ? 'Formål' : 'Purpose',
    scopeH:       da ? 'Scope' : 'Scope',
    roles:        da ? 'Roller & Ansvar' : 'Roles & Responsibilities',
    prereqs:      da ? 'Forudsætninger & Udstyr' : 'Prerequisites & Equipment',
    prereqsH:     da ? 'Forudsætninger' : 'Prerequisites',
    equipH:       da ? 'Udstyr & Systemer' : 'Equipment & Systems',
    procedure:    da ? 'Fremgangsmåde' : 'Sequential Procedure',
    procDesc:     da ? 'Nedenfor vises det processuelle BPMN-diagram efterfulgt af de detaljerede trin.' : 'The BPMN diagram below is followed by the detailed step-by-step procedure.',
    exceptions:   da ? 'Undtagelser & Fejlhåndtering' : 'Exceptions & Troubleshooting',
    scenario:     da ? 'Scenarie' : 'Scenario',
    action:       da ? 'Handling' : 'Action',
    escalation:   da ? 'Eskalering' : 'Escalation Path',
    condition:    da ? 'Betingelse' : 'Condition',
    contact:      da ? 'Kontakt' : 'Contact',
    references:   da ? 'Referencer & Bilag' : 'References & Appendices',
    confidential: da ? 'FORTROLIGT — Intern brug' : 'CONFIDENTIAL — Internal use only',
    generatedBy:  da ? 'Genereret med Ailean' : 'Generated with Ailean',
    responsible:  da ? 'Ansvarlig' : 'Responsible',
    description:  da ? 'Beskrivelse' : 'Description',
    noExceptions: da ? 'Ingen specifikke undtagelser identificeret.' : 'No specific exceptions identified.',
    noRefs:       da ? 'Ingen specifikke referencer identificeret.' : 'No specific references identified.',
  };

  const rolesRows = roles.map(r => {
    const acts = (parsed.activities || []).filter(a => a.performer === r.id);
    return `<tr>
      <td><strong class="editable">${esc(r.name)}</strong></td>
      <td class="editable">${acts.map(a => esc(a.name)).join(', ') || '—'}</td>
    </tr>`;
  }).join('');

  const prereqList = (content.prerequisites || []).map(p => `<li class="editable">${esc(p)}</li>`).join('') || `<li class="editable">—</li>`;
  const equipList  = (content.equipment || []).map(e => `<li class="editable">${esc(e)}</li>`).join('') || `<li class="editable">—</li>`;

  const exceptRows = (content.exceptions || []).length
    ? (content.exceptions || []).map(ex => `<tr><td class="editable">${esc(ex.scenario)}</td><td class="editable">${esc(ex.action)}</td></tr>`).join('')
    : `<tr><td class="editable" colspan="2">${T.noExceptions}</td></tr>`;

  const escalRows = (content.escalation || []).length
    ? (content.escalation || []).map(es => `<tr><td class="editable">${esc(es.condition)}</td><td class="editable">${esc(es.contact)}</td></tr>`).join('')
    : '';

  const refList = (content.references || []).length
    ? (content.references || []).map(r => `<li class="editable">${esc(r)}</li>`).join('')
    : `<li class="editable">${T.noRefs}</li>`;

  const stepsHtml = steps.map(renderStep).join('\n');

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="Company logo" class="company-logo" />`
    : '';

  const diagramHtml = diagramSvg
    ? `<div class="diagram-wrap">${diagramSvg}</div>`
    : '';

  const editLabel  = da ? '✎ Rediger' : '✎ Edit';
  const doneLabel  = da ? '✓ Færdig' : '✓ Done editing';
  const printLabel = da ? '🖨 Udskriv / Gem som PDF' : '🖨 Print / Save as PDF';
  const editHint   = da ? 'Klik på et felt for at redigere' : 'Click any field to edit';

  return `<!DOCTYPE html>
<html lang="${lang || 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOP — ${esc(processName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    background: #f4f2fc;
    padding: 0;
  }

  /* ── Edit toolbar ── */
  #edit-toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: #1a0a3c;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  }
  #edit-toolbar .tb-left { display: flex; align-items: center; gap: 10px; }
  #edit-toolbar .tb-label { font-size: 9pt; color: #b8aee8; letter-spacing: 0.05em; }
  #edit-toolbar .tb-hint { font-size: 8.5pt; color: #7c6ab0; font-style: italic; display: none; }
  body.edit-mode #edit-toolbar .tb-hint { display: inline; }
  #btn-edit {
    font-size: 9pt; font-weight: 700; padding: 6px 16px;
    border-radius: 6px; border: none; cursor: pointer;
    background: #7c5cbf; color: #fff; transition: background 0.15s;
  }
  #btn-edit:hover { background: #9d6bcf; }
  body.edit-mode #btn-edit { background: #2d9a50; }
  body.edit-mode #btn-edit:hover { background: #3ab860; }
  #btn-print {
    font-size: 9pt; font-weight: 600; padding: 6px 16px;
    border-radius: 6px; border: 1px solid #4a3070; cursor: pointer;
    background: transparent; color: #c8bbf0; transition: all 0.15s;
  }
  #btn-print:hover { background: #2d1a5e; color: #fff; }

  /* ── Page layout ── */
  .page { max-width: 900px; margin: 0 auto; padding: 40px 56px 64px; background: #fff; box-shadow: 0 0 40px rgba(60,20,120,0.10); }

  /* ── Document header ── */
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 3px solid #3b1f6e;
    padding-bottom: 18px;
    margin-bottom: 28px;
    gap: 24px;
  }
  .company-logo { max-height: 52px; max-width: 200px; object-fit: contain; }
  .doc-title-block { flex: 1; }
  .doc-title-block .label {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7c5cbf;
  }
  .doc-title-block h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #1a0a3c;
    line-height: 1.2;
    margin-top: 4px;
  }

  /* ── Control table ── */
  .control-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 36px;
  }
  .control-table th {
    background: #f3eeff;
    color: #4a2c8a;
    font-weight: 700;
    font-size: 8pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 7px 12px;
    border: 1px solid #ddd8f0;
    text-align: left;
  }
  .control-table td {
    padding: 7px 12px;
    border: 1px solid #ddd8f0;
    color: #2d2d45;
  }

  /* ── Section headings ── */
  .section { margin-bottom: 36px; }
  .section-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8e3f2;
  }
  .section-num {
    font-size: 9pt;
    font-weight: 800;
    color: #7c5cbf;
    letter-spacing: 0.1em;
    min-width: 28px;
  }
  .section-title {
    font-size: 13pt;
    font-weight: 700;
    color: #1a0a3c;
  }

  /* ── Sub-section headings ── */
  h3 {
    font-size: 10pt;
    font-weight: 700;
    color: #3b1f6e;
    margin: 14px 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  p { margin-bottom: 8px; color: #2d2d45; }

  ul, ol { padding-left: 20px; margin-bottom: 8px; }
  li { margin-bottom: 4px; color: #2d2d45; }

  /* ── Roles table ── */
  .roles-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-top: 8px;
  }
  .roles-table th {
    background: #f3eeff;
    color: #4a2c8a;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 7px 12px;
    border: 1px solid #ddd8f0;
    text-align: left;
  }
  .roles-table td {
    padding: 7px 12px;
    border: 1px solid #ddd8f0;
    vertical-align: top;
  }

  /* ── Exception / escalation tables ── */
  .ex-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-top: 8px;
  }
  .ex-table th {
    background: #fff4e6;
    color: #a05d00;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 7px 12px;
    border: 1px solid #f0ddc0;
    text-align: left;
  }
  .ex-table td {
    padding: 7px 12px;
    border: 1px solid #f0ddc0;
    vertical-align: top;
  }

  /* ── Procedure steps ── */
  .steps-container { margin-top: 16px; }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 10px 14px;
    margin-bottom: 4px;
    border-radius: 8px;
  }
  .step-num {
    font-size: 10pt;
    font-weight: 800;
    color: #7c5cbf;
    min-width: 26px;
    text-align: center;
    padding-top: 1px;
  }
  .step-body { flex: 1; }
  .step-body strong { font-size: 10.5pt; color: #1a0a3c; }

  .step-activity { background: #fafafa; border: 1px solid #eee; }
  .step-gateway  { background: #fff8ec; border: 1px solid #f0ddc0; }
  .step-gateway .step-num { color: #b06000; }
  .step-start   { background: #f0fce8; border: 1px solid #c2eaaa; }
  .step-start .step-num { color: #3a7f1a; }
  .step-end     { background: #fff0f0; border: 1px solid #f5c0c0; }
  .step-end .step-num { color: #a01010; }
  .step-event   { background: #f0f7ff; border: 1px solid #c0d8f5; }

  .role-badge {
    display: inline-block;
    font-size: 8pt;
    font-weight: 600;
    color: #5a3fa0;
    background: #ede8fa;
    border-radius: 4px;
    padding: 1px 7px;
    margin-left: 8px;
    vertical-align: middle;
    letter-spacing: 0.02em;
  }

  .branches { margin: 6px 0 0 4px; padding-left: 16px; }
  .branches li { margin-bottom: 2px; font-size: 10pt; }

  /* ── Diagram ── */
  .diagram-wrap {
    border: 1px solid #ddd8f0;
    border-radius: 10px;
    padding: 16px;
    background: #fafbff;
    margin: 16px 0;
    overflow: hidden;
  }
  .diagram-wrap svg { width: 100%; height: auto; display: block; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 48px;
    padding-top: 12px;
    border-top: 1px solid #ddd8f0;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #999;
  }

  /* ── Editable elements — idle ── */
  .editable { outline: none; border-radius: 3px; transition: background 0.12s, box-shadow 0.12s; }

  /* ── Edit mode: highlight editable fields ── */
  body.edit-mode .editable {
    background: #f5f0ff;
    box-shadow: 0 0 0 2px #c4aff0;
    cursor: text;
    border-radius: 3px;
    min-width: 20px;
    display: inline-block;
  }
  body.edit-mode td.editable { display: table-cell; }
  body.edit-mode li.editable { display: list-item; }
  body.edit-mode .editable:focus {
    background: #ede5ff;
    box-shadow: 0 0 0 2px #7c5cbf;
    outline: none;
  }
  body.edit-mode .editable:hover:not(:focus) { box-shadow: 0 0 0 2px #b8a0e8; }

  /* ── Print ── */
  @media print {
    body { font-size: 10pt; background: #fff; }
    .page { padding: 0; max-width: 100%; box-shadow: none; }
    .step { break-inside: avoid; }
    .section { break-inside: avoid; }
    .doc-header { break-after: avoid; }
    #edit-toolbar { display: none !important; }
    .editable { background: none !important; box-shadow: none !important; }
  }
</style>
</head>
<body>

<!-- Edit toolbar -->
<div id="edit-toolbar">
  <div class="tb-left">
    <span class="tb-label">SOP</span>
    <span class="tb-hint">${editHint}</span>
  </div>
  <div style="display:flex;gap:8px">
    <button id="btn-edit" onclick="toggleEdit()">${editLabel}</button>
    <button id="btn-print" onclick="window.print()">${printLabel}</button>
  </div>
</div>

<div class="page">

  <!-- Document header -->
  <div class="doc-header">
    <div class="doc-title-block">
      <div class="label">Standard Operating Procedure</div>
      <h1 class="editable">${esc(processName)}</h1>
    </div>
    ${logoHtml}
  </div>

  <!-- Section 1: Document Control -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">01</span>
      <span class="section-title">${T.docControl}</span>
    </div>
    <table class="control-table">
      <tr><th>${T.title}</th><td class="editable">${esc(processName)}</td></tr>
      <tr><th>${T.docId}</th><td class="editable">${esc(docId(processName))}</td></tr>
      <tr><th>${T.version}</th><td class="editable">v1.0</td></tr>
      <tr><th>${T.effectDate}</th><td class="editable">${isoDate()}</td></tr>
      <tr><th>${T.author}</th><td class="editable">—</td></tr>
      <tr><th>${T.approver}</th><td class="editable">—</td></tr>
    </table>
  </div>

  <!-- Section 2: Purpose & Scope -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">02</span>
      <span class="section-title">${T.purpose}</span>
    </div>
    <h3>${T.purposeH}</h3>
    <p class="editable">${esc(content.purpose || '—')}</p>
    <h3>${T.scopeH}</h3>
    <p class="editable">${esc(content.scope || '—')}</p>
  </div>

  <!-- Section 3: Roles & Responsibilities -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">03</span>
      <span class="section-title">${T.roles}</span>
    </div>
    <table class="roles-table">
      <thead><tr><th>${T.responsible}</th><th>${T.description}</th></tr></thead>
      <tbody>${rolesRows || '<tr><td colspan="2">—</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Section 4: Prerequisites & Equipment -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">04</span>
      <span class="section-title">${T.prereqs}</span>
    </div>
    <h3>${T.prereqsH}</h3>
    <ul>${prereqList}</ul>
    <h3>${T.equipH}</h3>
    <ul>${equipList}</ul>
  </div>

  <!-- Section 5: Sequential Procedure -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">05</span>
      <span class="section-title">${T.procedure}</span>
    </div>
    <p class="editable">${T.procDesc}</p>
    ${diagramHtml}
    <div class="steps-container">
      ${stepsHtml}
    </div>
  </div>

  <!-- Section 6: Exceptions & Troubleshooting -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">06</span>
      <span class="section-title">${T.exceptions}</span>
    </div>
    <table class="ex-table">
      <thead><tr><th>${T.scenario}</th><th>${T.action}</th></tr></thead>
      <tbody>${exceptRows}</tbody>
    </table>
    ${escalRows ? `
    <h3 style="margin-top:16px">${T.escalation}</h3>
    <table class="ex-table">
      <thead><tr><th>${T.condition}</th><th>${T.contact}</th></tr></thead>
      <tbody>${escalRows}</tbody>
    </table>` : ''}
  </div>

  <!-- Section 7: References & Appendices -->
  <div class="section">
    <div class="section-header">
      <span class="section-num">07</span>
      <span class="section-title">${T.references}</span>
    </div>
    <ul>${refList}</ul>
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <span>${T.confidential}</span>
    <span>${T.generatedBy} · ${isoDate()}</span>
  </div>

</div>

<script>
  var editing = false;
  var editBtn = document.getElementById('btn-edit');
  var editLabel = '${editLabel}';
  var doneLabel = '${doneLabel}';

  function toggleEdit() {
    editing = !editing;
    document.body.classList.toggle('edit-mode', editing);
    editBtn.textContent = editing ? doneLabel : editLabel;
    document.querySelectorAll('.editable').forEach(function(el) {
      el.contentEditable = editing ? 'true' : 'false';
    });
    if (editing) {
      // Focus the first editable field for quick start
      var first = document.querySelector('.editable');
      if (first) { first.focus(); }
    }
  }

  // Prevent Enter from inserting <div> — keep it as <br> instead
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && editing) {
      var el = document.activeElement;
      if (el && el.classList.contains('editable')) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    }
    // Esc exits edit mode
    if (e.key === 'Escape' && editing) toggleEdit();
  });
</script>
</body>
</html>`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function generateSop({ parsed, processDescription, processName, companyLogo, apiKey, proxyAuth, lang, diagramSvg }) {
  const content = await fetchNarrativeSections(parsed, processDescription, processName, apiKey, proxyAuth, lang);
  return buildSopHtml({ content, parsed, processName, companyLogo, diagramSvg, lang });
}
