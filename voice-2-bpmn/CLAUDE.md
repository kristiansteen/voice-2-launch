# BPMN Interview Assistant — Claude Code Project Brief

## What we are building
A web-based MVP that lets a user paste or type a process interview transcript, parse it into BPMN elements using an LLM, review and edit those elements, and download a valid BPMN 2.0 XML file.

---

## MVP Scope (Phase 1 only)
1. User pastes or types a transcript into an editable text area
2. User clicks "Parse" — the app sends the transcript to the Anthropic API
3. The LLM extracts BPMN elements and returns structured JSON
4. The app displays the extracted elements in a review panel grouped by type
5. User can edit, delete, or add elements in the review panel
6. User clicks "Generate XML" — the app converts the JSON to valid BPMN 2.0 XML
7. User can preview the diagram in-browser using bpmn-js
8. User can download the .xml file

---

## Tech Stack
- **Frontend:** React + Tailwind CSS (single page app)
- **LLM:** Anthropic API — model: `claude-sonnet-4-20250514`, max_tokens: 4000
- **BPMN rendering:** bpmn-js (npm: bpmn-js)
- **XML generation:** Custom JSON-to-BPMN-XML converter (see schema below)
- **No backend required for MVP** — all logic runs client-side, user provides their own Anthropic API key

---

## LLM Parsing Instructions
Send the transcript to the Anthropic API with this system prompt:

```
You are a BPMN process modelling expert. 
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
- If you are uncertain about an element, still include it — mark ambiguous names with a "?" suffix
```

---

## JSON to BPMN 2.0 XML Conversion
Convert the parsed JSON into BPMN 2.0 XML following this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" name="{process_name}" isExecutable="false">
    <!-- startEvent, endEvent, userTask, exclusiveGateway, sequenceFlow elements -->
  </process>
  <BPMNDiagram id="BPMNDiagram_1">
    <BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <!-- BPMNShape and BPMNEdge elements with auto-layout coordinates -->
    </BPMNPlane>
  </BPMNDiagram>
</definitions>
```

Use a simple left-to-right auto-layout algorithm:
- Place elements in sequence flow order
- X position: increment by 150px per step
- Y position: 200px baseline, branch up/down by 100px for gateways
- Each shape: width=100, height=80 (tasks); width=36, height=36 (events/gateways)

---

## UI Layout
```
┌─────────────────────────────────────────────────────┐
│  BPMN Interview Assistant                    [⚙ API Key] │
├──────────────────────┬──────────────────────────────┤
│  TRANSCRIPT          │  BPMN ELEMENTS               │
│                      │                              │
│  [Editable textarea] │  Roles:      [list + edit]   │
│                      │  Activities: [list + edit]   │
│                      │  Events:     [list + edit]   │
│                      │  Gateways:   [list + edit]   │
│                      │  Flows:      [list + edit]   │
│  [Parse →]           │  [Generate XML]              │
├──────────────────────┴──────────────────────────────┤
│  BPMN DIAGRAM PREVIEW (bpmn-js viewer)              │
│                                                     │
│                                          [⬇ Download XML] │
└─────────────────────────────────────────────────────┘
```

---

## Key Behaviours
- API key is entered once, stored in React state (not localStorage)
- Parse button is disabled if transcript is empty or API key is missing
- Show a loading spinner during LLM call
- If JSON parsing fails, show the raw LLM response for debugging
- All element lists in the review panel are editable inline
- "Generate XML" re-runs every time it is clicked, reflecting latest edits
- bpmn-js viewer refreshes automatically when new XML is generated
- Download button saves the file as `process-[timestamp].xml`

---

## Example Transcript (use for testing)
```
Interviewer: Can you walk me through the invoice approval process?

SME: Sure. When we receive an invoice from a supplier, the Accounts Payable clerk 
first checks if it matches a purchase order. If it matches, they send it to the 
relevant department manager for approval. The manager either approves or rejects it. 
If approved, AP processes the payment. If rejected, they notify the supplier and 
archive the invoice. If there's no matching PO, AP sends it back to procurement 
to raise one first.
```

Expected output should include:
- Roles: Accounts Payable Clerk, Department Manager, Procurement
- Activities: Check PO match, Send for approval, Approve invoice, Reject invoice, Process payment, Notify supplier, Archive invoice, Raise PO
- Gateways: PO match? (exclusive), Manager decision (exclusive)
- Events: Start (invoice received), End (payment processed), End (invoice archived)

---

## Relevant Open Source Libraries
- **bpmn-js**: `npm install bpmn-js` — in-browser BPMN viewer/editor
- **bpmn-auto-layout**: `npm install bpmn-auto-layout` — auto-layout for generated XML
- Reference repo: https://github.com/jtlicardo/bpmn-assistant (JSON-intermediate approach)

---

## Out of Scope for MVP
- User authentication / login
- Voice recording
- Role library / persistence
- API export to BPM platforms
- Multi-user or cloud storage
- Re-parse with diff tracking

These are Phase 2+ features. Build clean, modular code so they are easy to add.

---

## Definition of Done for MVP
- [ ] User can paste a transcript and click Parse
- [ ] Extracted BPMN elements display correctly in review panel
- [ ] User can edit elements before generating XML
- [ ] Valid BPMN 2.0 XML is generated
- [ ] Diagram renders in bpmn-js viewer
- [ ] XML can be downloaded as a file
- [ ] Works entirely in the browser with no backend
