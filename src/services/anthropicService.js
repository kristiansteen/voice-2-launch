import Anthropic from '@anthropic-ai/sdk';

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
- duration_weeks must be exactly 14
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

export async function parseTranscript(transcript, apiKey, processContext = {}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: transcript }],
  });

  const text = message.content[0].text.trim();

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('Failed to parse LLM response as JSON');
    err.rawResponse = text;
    throw err;
  }
}

export async function getSuggestions(parsed, apiKey) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SUGGESTIONS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(parsed, null, 2) }],
  });

  return message.content[0].text;
}

export async function parseVoiceToDescription(transcript, apiKey, processContext = {}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system,
    messages: [{ role: 'user', content: transcript }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('Failed to parse description as JSON');
    err.rawResponse = text;
    throw err;
  }
}

export async function parseToBpmn(description, apiKey, processContext = {}) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let system = SYSTEM_PROMPT;
  if (!processContext.isCustom && processContext.apqcNodeId) {
    system =
      `This process belongs to APQC PCF category ${processContext.apqcNodeId} — "${processContext.apqcNodeName}". ` +
      `Use standard PCF terminology when naming activities, roles, and events.\n\n` +
      system;
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: `Extract BPMN elements from this structured process description:\n\n${JSON.stringify(description, null, 2)}` }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('Failed to parse BPMN JSON from description');
    err.rawResponse = text;
    throw err;
  }
}

export async function getStructuredImprovements(parsed, apiKey) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: IMPROVEMENTS_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(parsed, null, 2) }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('Failed to parse improvements as JSON');
    err.rawResponse = text;
    throw err;
  }
}

export async function generateProjectPlan(parsed, selectedImprovements, apiKey, knownRisks = []) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const input = {
    process: parsed,
    selected_improvements: selectedImprovements,
    ...(knownRisks.length > 0 ? { known_risks: knownRisks } : {}),
  };

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: PROJECT_PLAN_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }],
  });

  const text = message.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('Failed to parse project plan as JSON');
    err.rawResponse = text;
    throw err;
  }
}
