const MODEL = 'claude-sonnet-4-20250514';
const PROXY = '/api/proxy';

async function callClaude(token, system, userMessage, maxTokens = 2000) {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: MODEL,
      system,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error(err.error || 'Daglig grænse nået. Prøv igen i morgen.');
    throw new Error(err.error || `Fejl fra AI (${res.status})`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  // Strip markdown code fences if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return jsonMatch ? jsonMatch[1].trim() : text.trim();
}

// ── Step 2: Interview → Jobbeskrivelse ───────────────────────────────────────
export async function parseInterviewToJobDesc(token, interviewText) {
  const system = `Du er en erfaren håndværkerkoordinator. Din opgave er at analysere en samtale/interview med en kunde og udtrække alle relevante detaljer om det ønskede arbejde.

Returner UDELUKKENDE et gyldigt JSON-objekt med følgende struktur — ingen forklaring, ingen markdown:
{
  "titel": "Kort titel på arbejdet (maks 60 tegn)",
  "beskrivelse": "Detaljeret beskrivelse af arbejdet der skal udføres",
  "omfang": "Overordnet omfang og eventuelle begrænsninger",
  "adresse": "Arbejdsstedsadresse hvis nævnt, ellers tom streng",
  "startdato": "Ønsket startdato hvis nævnt, ellers tom streng",
  "kunde": {
    "navn": "Kundens fulde navn",
    "adresse": "Kundens adresse",
    "postnr": "Postnummer",
    "by": "By",
    "telefon": "Telefonnummer",
    "email": "Email"
  },
  "noter": "Eventuelle særlige bemærkninger eller aftaler"
}

Hvis oplysninger mangler, brug tomme strenge. Skriv alt på dansk.`;

  const raw = await callClaude(token, system, interviewText, 1500);
  return JSON.parse(raw);
}

// ── Step 3: Jobbeskrivelse → Tilbud ──────────────────────────────────────────
export async function generateTilbud(token, jobbeskrivelse, company) {
  const system = `Du er en erfaren håndværker der laver professionelle tilbud til kunder i Danmark.

Baseret på jobbeskrivelsen, generer et realistisk og detaljeret tilbud med arbejdslinjer.

Returner UDELUKKENDE et gyldigt JSON-objekt med følgende struktur — ingen forklaring, ingen markdown:
{
  "linjer": [
    {
      "type": "arbejdsløn|materialer|udlæg",
      "beskrivelse": "Beskrivelse af posten",
      "antal": 1,
      "enhed": "stk|timer|m2|m|ls",
      "enhedspris": 750,
      "beloeb": 750
    }
  ],
  "noter": "Eventuelle noter til tilbuddet",
  "betalingsbetingelser": "Netto 14 dage",
  "gyldighedsdage": 30,
  "forbehold": "Standard forbehold og betingelser"
}

Regler:
- Priser i DKK ekskl. moms
- Arbejdsløn: typisk 450-850 kr/time afhængig af fag
- Adskil tydeligt arbejdsløn fra materialer
- Inkluder realistiske mængder og priser
- beloeb = antal * enhedspris
- Skriv alt på dansk`;

  const raw = await callClaude(
    token,
    system,
    `Virksomhed: ${company.navn}\nFag: håndværker\n\nJobbeskrivelse:\n${JSON.stringify(jobbeskrivelse, null, 2)}`,
    2000
  );
  return JSON.parse(raw);
}

// ── Step 4: Tilbud → Projektplan ─────────────────────────────────────────────
export async function generateProjektplan(token, jobbeskrivelse, tilbud) {
  const system = `Du er en erfaren projektleder for håndværksfirmaer i Danmark.

Baseret på tilbuddet, generer en realistisk projektplan med faser og opgaver.

Returner UDELUKKENDE et gyldigt JSON-objekt med følgende struktur — ingen forklaring, ingen markdown:
{
  "faser": [
    {
      "navn": "Fase navn",
      "varighed": "Estimeret varighed fx '2 dage'",
      "opgaver": [
        "Opgavebeskrivelse 1",
        "Opgavebeskrivelse 2"
      ]
    }
  ],
  "totalVarighedEstimat": "Total estimeret varighed",
  "forudsaetninger": ["Forudsætning 1", "Forudsætning 2"]
}

Skriv alt på dansk. Vær konkret og realistisk.`;

  const raw = await callClaude(
    token,
    system,
    `Jobbeskrivelse:\n${jobbeskrivelse.titel}\n${jobbeskrivelse.beskrivelse}\n\nTilbudslinjer:\n${tilbud.linjer.map(l => `- ${l.beskrivelse} (${l.antal} ${l.enhed})`).join('\n')}`,
    1500
  );
  return JSON.parse(raw);
}
