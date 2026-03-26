import Anthropic from '@anthropic-ai/sdk';

// ── Client factory ────────────────────────────────────────────────────────────
// Returns either a real Anthropic client (BYOK) or a proxy shim (vimpl auth).
function makeClient(apiKey, proxyAuth = null) {
  if (apiKey) return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // Proxy shim — mirrors the Anthropic SDK's messages.create interface
  return {
    messages: {
      async create(params) {
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyAuth.token}`,
          },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Proxy error');
        }

        return res.json();
      },
    },
  };
}

// ── JSON parse with single auto-retry ─────────────────────────────────────────
// If Claude's response isn't valid JSON, send one follow-up asking it to fix the
// output, then try again. Throws on second failure.
async function parseJsonWithRetry(client, params, rawText) {
  const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Retry: ask Claude to return only the JSON
    const retryMessage = await client.messages.create({
      ...params,
      messages: [
        ...params.messages,
        { role: 'assistant', content: rawText },
        { role: 'user', content: 'Your response was not valid JSON. Return ONLY the JSON object/array with no explanation, markdown, or preamble.' },
      ],
    });
    const retryText = retryMessage.content[0].text.trim();
    const retryCleaned = retryText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    try {
      return JSON.parse(retryCleaned);
    } catch {
      const err = new Error('Failed to parse Claude response as JSON after retry');
      err.rawResponse = retryText;
      throw err;
    }
  }
}

const SUGGESTIONS_PROMPT = `You are a BPMN process improvement expert. Analyse the following BPMN process JSON and provide concise, actionable improvement suggestions.

Focus on:
- Missing steps or implicit activities
- Unclear or ambiguous gateways
- Error handling and exception flows
- Redundant or duplicated activities
- Roles and responsibilities gaps
- Process efficiency improvements

Format your response as a numbered list of specific suggestions. Be concise and practical.`;

const DESCRIPTION_PROMPT = `You are a business process analyst. Extract a structured process description from the following interview transcript.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.

The JSON must follow this exact schema:
{
  "process_name": "string",
  "overview": "paragraph describing the overall process",
  "scope": "paragraph describing what is in and out of scope",
  "roles": [{ "name": "string", "responsibilities": "string" }],
  "steps": [{ "order": 1, "name": "string", "performer": "string", "description": "string" }],
  "exceptions": ["string"],
  "known_issues": ["string"]
}`;

const IMPROVEMENTS_PROMPT = `You are a business process improvement expert. Analyse the following process description and BPMN JSON.
Return ONLY a valid JSON array of improvement objects — no explanation, no markdown, no preamble.

Each object must follow this exact schema:
{
  "id": "imp_1",
  "title": "string",
  "category": "automation|governance|clarity|efficiency|risk",
  "description": "string",
  "benefit": "string",
  "effort": "low|medium|high",
  "effort_score": 50,
  "impact_score": 70
}

Rules:
- effort_score: integer 0-100 (low ≈ 25, medium ≈ 50, high ≈ 75), representing implementation effort
- impact_score: integer 0-100, representing estimated business impact
- Return 4-8 improvements covering different categories.`;

const PROJECT_PLAN_PROMPT = `You are a project planning expert. Generate a project plan for implementing the following process improvements.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.

The JSON must follow this exact schema:
{
  "plan_name": "string",
  "duration_weeks": 8,
  "tracks": [{ "id": "track_1", "name": "string" }],
  "tasks": [{
    "id": "task_1",
    "title": "string",
    "track_id": "track_1",
    "week_start": 1,
    "week_end": 2,
    "owner": "string",
    "improvement_id": "imp_1"
  }],
  "risks": [{
    "id": "risk_1",
    "title": "string",
    "description": "string",
    "probability": 60,
    "consequence": 70,
    "mitigation": "string",
    "task_id": "task_1"
  }]
}

Rules:
- Use the duration_weeks value provided in the input (default 14 if not provided)
- probability and consequence are integers 0-100
- Each selected improvement should have at least one task
- Group related tasks into 2-4 tracks (e.g., "Technology", "Process", "People", "Governance")
- Each risk must reference a task_id
- Include 3-6 risks total
- If known_risks are provided in the input, include ALL of them verbatim in the output risks array (preserving their title, probability, consequence, mitigation), then add additional AI-generated risks as needed`;

const SYSTEM_PROMPT = `You are a BPMN process modelling expert.
Analyse the following interview transcript and extract all BPMN 2.0 elements.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.

The JSON must follow this exact schema:
{
  "process_name": "string",
  "roles": [
    { "id": "role_1", "name": "string" }
  ],
  "events": [
    { "id": "event_1", "type": "start|end|intermediate", "name": "string" }
  ],
  "activities": [
    { "id": "act_1", "name": "string", "performer": "role_id or null" }
  ],
  "gateways": [
    { "id": "gw_1", "type": "exclusive|parallel|inclusive", "name": "string" }
  ],
  "sequence_flows": [
    { "id": "flow_1", "from": "element_id", "to": "element_id", "condition": "string or null" }
  ]
}

Rules:
- Every activity must have a unique id starting with "act_"
- Every gateway must have a unique id starting with "gw_"
- Every event must have a unique id starting with "event_"
- Every role must have a unique id starting with "role_"
- sequence_flows must reference valid element ids
- If you are uncertain about an element, still include it — mark ambiguous names with a "?" suffix`;

export async function parseTranscript(transcript, apiKey, processContext = {}, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  let system = SYSTEM_PROMPT;
  if (!processContext.isCustom && processContext.apqcNodeId) {
    system =
      `This process belongs to APQC PCF category ${processContext.apqcNodeId} — "${processContext.apqcNodeName}". ` +
      `Use standard PCF terminology when naming activities, roles, and events.\n\n` +
      system;
  } else if (processContext.isCustom && processContext.customLabel) {
    system =
      `This is a custom/non-standard process described as: "${processContext.customLabel}". ` +
      `Name elements clearly based on the transcript.\n\n` +
      system;
  }

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: transcript }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

export async function getSuggestions(parsed, apiKey, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SUGGESTIONS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(parsed, null, 2) }],
  });

  return message.content[0].text;
}

export async function parseVoiceToDescription(transcript, apiKey, processContext = {}, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  let system = DESCRIPTION_PROMPT;
  if (!processContext.isCustom && processContext.apqcNodeId) {
    system =
      `This process belongs to APQC PCF category ${processContext.apqcNodeId} — "${processContext.apqcNodeName}". ` +
      `Use standard PCF terminology.\n\n` +
      system;
  } else if (processContext.isCustom && processContext.customLabel) {
    system =
      `This is a custom process described as: "${processContext.customLabel}".\n\n` +
      system;
  }

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: transcript }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

export async function parseToBpmn(description, apiKey, processContext = {}, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  let system = SYSTEM_PROMPT;
  if (!processContext.isCustom && processContext.apqcNodeId) {
    system =
      `This process belongs to APQC PCF category ${processContext.apqcNodeId} — "${processContext.apqcNodeName}". ` +
      `Use standard PCF terminology when naming activities, roles, and events.\n\n` +
      system;
  }

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: `Extract BPMN elements from this structured process description:\n\n${JSON.stringify(description, null, 2)}` }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

export async function getStructuredImprovements(parsed, apiKey, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: IMPROVEMENTS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(parsed, null, 2) }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

export async function generateProjectPlan(parsed, selectedImprovements, apiKey, knownRisks = [], proxyAuth = null, startDate = null, durationWeeks = 14) {
  const client = makeClient(apiKey, proxyAuth);

  const input = {
    process: parsed,
    selected_improvements: selectedImprovements,
    duration_weeks: durationWeeks,
    ...(startDate ? { project_start_date: startDate } : {}),
    ...(knownRisks.length > 0 ? { known_risks: knownRisks } : {}),
  };

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: PROJECT_PLAN_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

// ── TO-BE BPMN Generation ─────────────────────────────────────────────────────
// Takes the AS-IS parsed BPMN JSON + selected improvements and generates a
// modified TO-BE BPMN JSON with the improvements applied.
const TO_BE_PROMPT = `You are a BPMN process modelling expert. You will receive an AS-IS BPMN process as JSON and a list of approved process improvements. Apply the improvements to produce a TO-BE version of the process.

Return ONLY a valid JSON object following the exact same schema as the input — no explanation, no markdown, no preamble.

Rules:
- Keep the same top-level schema: process_name, roles, events, activities, gateways, sequence_flows
- Add new roles for systems/automation introduced by improvements (e.g. "OCR System", "Automation Engine")
- Rename or replace manual tasks with automated/improved equivalents where applicable
- Add or remove activities, gateways, and flows to reflect the improvements
- Remove steps that the improvements eliminate
- All ids must be unique; new elements use the next available number (e.g. act_13, role_7)
- sequence_flows must reference only valid element ids in the output
- Set process_name to the original name suffixed with " — TO-BE"`;

export async function generateToBeBpmn(asIsParsed, improvements, apiKey, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  const input = {
    as_is_bpmn: asIsParsed,
    improvements: improvements.map(i => ({ title: i.title, description: i.description, category: i.category })),
  };

  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: TO_BE_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }],
  };
  const message = await client.messages.create(params);
  return parseJsonWithRetry(client, params, message.content[0].text.trim());
}

// ── Process Metrics Extraction ────────────────────────────────────────────────
const METRICS_PROMPT = `You are a business process analyst. Based on the BPMN process structure and the interview transcript, estimate operational metrics for each process element.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.

Schema:
{
  "activities": [
    { "id": "act_1", "duration_value": 30, "duration_unit": "min", "backlog": 150 }
  ],
  "gateways": [
    { "id": "gw_1", "branches": [
      { "condition": "Documents available", "rate": 75 },
      { "condition": "Missing documents", "rate": 25 }
    ]}
  ]
}

Rules:
- duration_unit must be one of: "min", "hr", "day", "week"
- duration_value is a positive number representing time per single case instance
- backlog is a positive integer — estimated number of open/waiting cases at any given point in time
- For each gateway, list ALL outgoing branches (from gateway_branches input) with rates summing to 100
- Base estimates on the transcript where possible; otherwise use industry norms for the process type
- Only include IDs that exist in the input process`;

const TOBE_METRICS_PROMPT = `You are a business process improvement analyst. Given the AS-IS operational metrics and the approved improvements, estimate new TO-BE metrics.
Return ONLY a valid JSON object — no explanation, no markdown, no preamble.

Use the same schema as AS-IS metrics:
{
  "activities": [
    { "id": "act_1", "duration_value": 15, "duration_unit": "min", "backlog": 50 }
  ],
  "gateways": [
    { "id": "gw_1", "branches": [
      { "condition": "Documents available", "rate": 90 },
      { "condition": "Missing documents", "rate": 10 }
    ]}
  ]
}

Rules:
- Reflect the realistic impact of each selected improvement on duration, backlog, and gateway rates
- Automation typically reduces duration by 50–80% and backlog by 60–80%
- Quality/validation improvements typically push gateway success rates up by 10–30 percentage points
- Only include IDs that exist in the TO-BE BPMN input
- Gateway branch rates must sum to 100 per gateway`;

export async function extractProcessMetrics(parsed, transcript, apiKey, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  const gatewayBranches = {};
  for (const gw of parsed.gateways || []) {
    const outgoing = (parsed.sequence_flows || []).filter(f => f.from === gw.id && f.condition);
    gatewayBranches[gw.id] = outgoing.map(f => f.condition);
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: METRICS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify({ process: parsed, gateway_branches: gatewayBranches, transcript: transcript || '' }) }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

export async function estimateToBeMetrics(asParsed, toBeParsed, asIsMetrics, improvements, apiKey, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  const gatewayBranches = {};
  for (const gw of (toBeParsed?.gateways || [])) {
    const outgoing = (toBeParsed?.sequence_flows || []).filter(f => f.from === gw.id && f.condition);
    gatewayBranches[gw.id] = outgoing.map(f => f.condition);
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: TOBE_METRICS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify({
      as_is_process: asParsed,
      as_is_metrics: asIsMetrics,
      tobe_process: toBeParsed,
      tobe_gateway_branches: gatewayBranches,
      selected_improvements: improvements.map(i => ({ title: i.title, description: i.description, category: i.category })),
    }) }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

// ── Ailean Interview Follow-up ────────────────────────────────────────────────
// Returns a single follow-up question as plain text (no JSON).
export async function getInterviewFollowUp(transcript, conversationHistory, apiKey, processContext, proxyAuth = null) {
  const client = makeClient(apiKey, proxyAuth);

  let systemPrompt = `You are Ailean, an expert lean consultant and process discovery interviewer with 20+ years of experience. You are conducting a structured process mapping interview to capture a business process as a BPMN diagram.

You follow a strict three-phase approach and always know which phase you are in:

PHASE 1 — MAP ALL STEPS (breadth first)
Goal: establish the complete end-to-end sequence of activities before any detail.
- Push to get every step from start to finish in the correct order
- Ask "what happens next?" relentlessly until the end of the process is reached
- Do NOT ask about exceptions, roles, or details yet
- If the person jumps into detail or exceptions, gently redirect: acknowledge briefly, then ask what happens next
- This phase is complete only when a clear end event has been stated

PHASE 2 — CONFIRM THE END
Goal: make sure the end trigger is unambiguous.
- Ask specifically what signals the process is finished and who receives that signal
- Only one question needed here

PHASE 3 — DRILL INTO EACH STEP (depth, exceptions first)
Goal: enrich each step with decision conditions, roles, and exceptions.
- Work through the steps identified in Phase 1 one at a time, in order
- For each step ask: what can go wrong, what are the exceptions, and what happens then?
- Then ask who performs the step and what system or tool is used
- Only move to the next step when the current one is sufficiently detailed

Reading the transcript to determine the current phase:
- If no clear end event has been stated yet → you are in Phase 1
- If the end event was just confirmed → you are in Phase 2
- If a complete step sequence and end event exist → you are in Phase 3

General guidelines:
- Ask ONLY ONE focused question at a time — never multiple questions in one turn
- Keep it short: 1-2 natural sentences maximum
- Be warm, direct, and professional — like a trusted colleague who keeps things moving
- Briefly acknowledge the last answer, then drive forward
- Never revisit a step that has already been fully covered`;

  if (processContext?.apqcNodeName) {
    systemPrompt += `\n\nThe process being mapped is: ${processContext.apqcNodeName}`;
  }

  systemPrompt += `\n\nReturn ONLY your follow-up question. No preamble, no explanation, no quotation marks.`;

  const messages = [
    // Keep the last 6 turns (12 messages) to stay within context
    ...conversationHistory.slice(-12),
    {
      role: 'user',
      content: `Here is the interview transcript so far:\n\n${transcript}\n\nAsk your next follow-up question.`,
    },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 120,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text.trim();
}
