const MODEL = 'claude-sonnet-4-20250514';
const PROXY = '/api/proxy';

// Trade-specific hourly rates (DKK ekskl. moms) from Danish market research
const TIMERPRISER = {
  elektriker: { min: 500, max: 650, typisk: 575 },
  vvs: { min: 550, max: 700, typisk: 625 },
  tømrer: { min: 450, max: 550, typisk: 495 },
  maler: { min: 350, max: 450, typisk: 400 },
  murer: { min: 420, max: 520, typisk: 470 },
  tagdækker: { min: 450, max: 600, typisk: 525 },
  andet: { min: 400, max: 600, typisk: 500 },
};

// Trade-specific line item hints for realistic offers
const FAG_CONTEXT = {
  elektriker: `
Fag: Elektriker. Typiske linjer: kabelføring, tavleinstallation, stikkontakter (pr. stk.), afbrydere (pr. stk.), armaturer (stk.), gruppeledninger.
VIGTIGT: Inkluder altid "Verifikation og sikkerhedsdokumentation" som separat linje (~1.200-2.000 kr.) — dette er lovpligtigt.
Autorisationskrav: Nævn at arbejdet udføres af autoriseret elektriker (SIK-autoriseret).`,

  vvs: `
Fag: VVS-installatør. Typiske linjer: rørarbejde (pr. lm per rørtype), armaturer (stk), vandlåse, montage, afprøvning.
VIGTIGT: Inkluder "VVS-godkendelse/syn" som separat linje (~4.800-5.000 kr.) — dette er lovpligtigt og fakturerbart.
VVS-autorisationskrav gælder. Ofte format: fast pris pr. armatur inkl. materialer og montage.`,

  tømrer: `
Fag: Tømrer. Typiske linjer: konstruktionstræ (m eller stk), pladematerialer (m²), beslag (stk), vindues-/dørmontering, tætning/lister.
Prissæt typisk pr. m² eller løbende meter. Eventuel stilladsleje som separat linje.`,

  maler: `
Fag: Maler. Typiske linjer: forbehandling (m²), spartling (m²), grundingsstrøg (m²), mellemstrøg (m²), slutstrøg (m²).
Opdel pr. overfladetype: loft, vægge, træværk. Angiv malerfabrikat og glansgrad (mat/halvmåle/halvglans).`,

  murer: `
Fag: Murer. Typiske linjer: mursten (stk/m²), mørtel (m²), fugearbejde (m²), armering.
Prissæt pr. m² for murværk og pr. lm for fugearbejde. Stilladsleje separat hvis relevant.`,

  tagdækker: `
Fag: Tagdækker. Typiske linjer: nedtagning gammelt tag (m²), undertag (m²), nye lægter (lm), tagsten (m²),
inddækning ved kviste/skorstene (lm/stk), tagrender (lm), stilladsleje, affaldshåndtering.
Asbestattest separat linje hvis relevant.`,

  andet: `
Fag: Håndværker. Opdel tydeligt i arbejdsløn og materialer. Vær konkret med mængder og enheder.`,
};

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
export async function parseInterviewToJobDesc(token, interviewText, fag = 'andet') {
  const system = `Du er en erfaren håndværkerkoordinator (${fag}). Din opgave er at analysere en samtale/interview med en kunde og udtrække alle relevante detaljer om det ønskede arbejde.

Returner UDELUKKENDE et gyldigt JSON-objekt med følgende struktur — ingen forklaring, ingen markdown:
{
  "titel": "Kort titel på arbejdet (maks 60 tegn)",
  "beskrivelse": "Detaljeret beskrivelse af arbejdet der skal udføres",
  "omfang": "Hvad er inkluderet — og hvad er IKKE inkluderet (skriv eksplicit 'Ekskluderet: ...' hvis relevant)",
  "adresse": "Arbejdsstedsadresse hvis nævnt, ellers tom streng",
  "startdato": "Ønsket startdato hvis nævnt, ellers tom streng",
  "kunde": {
    "navn": "Kundens fulde navn",
    "adresse": "Kundens fakturaadresse",
    "postnr": "Postnummer",
    "by": "By",
    "telefon": "Telefonnummer",
    "email": "Email",
    "cvr": "CVR-nummer hvis erhvervskunde, ellers tom streng"
  },
  "noter": "Eventuelle særlige bemærkninger, aftaler eller forbehold"
}

Hvis oplysninger mangler, brug tomme strenge. Skriv alt på dansk. Vær konkret om omfang og ekskluderinger.`;

  const raw = await callClaude(token, system, interviewText, 1500);
  return JSON.parse(raw);
}

// ── Step 3: Jobbeskrivelse → Tilbud ──────────────────────────────────────────
export async function generateTilbud(token, jobbeskrivelse, company, kundeType = 'b2c') {
  const fag = company.fag ?? 'andet';
  const priser = TIMERPRISER[fag] ?? TIMERPRISER.andet;
  const fagCtx = FAG_CONTEXT[fag] ?? FAG_CONTEXT.andet;

  const system = `Du er en erfaren ${fag} der laver professionelle tilbud til kunder i Danmark.

${fagCtx}

Timepris for ${fag}: ${priser.min}–${priser.max} kr/t ekskl. moms (typisk ${priser.typisk} kr/t).

Kundeforhold: ${kundeType === 'b2c' ? 'Forbruger (B2C) — arbejdsløn skal fremgå separat jf. håndværkerfradragsreglerne' : 'Erhvervskunde (B2B)'}

VIGTIGT: Adskil ALTID arbejdsløn fra materialer i separate linjer — dette er lovpligtigt for håndværkerfradrag.

Returner UDELUKKENDE et gyldigt JSON-objekt med følgende struktur — ingen forklaring, ingen markdown:
{
  "linjer": [
    {
      "type": "arbejdsløn|materialer|udlæg",
      "beskrivelse": "Konkret beskrivelse af posten",
      "antal": 1,
      "enhed": "stk|timer|m2|m|lm|ls",
      "enhedspris": 575,
      "beloeb": 575
    }
  ],
  "noter": "Eventuelle noter, forbehold og betingelser",
  "betalingsbetingelser": "Netto 14 dage",
  "gyldighedsdage": 20,
  "gyldighedsEnhed": "arbejdsdage",
  "forbehold": "Priserne er ekskl. moms. Eventuelle uforudsete udgifter faktureres særskilt efter aftale. Ekstraarbejde igangsættes kun efter skriftlig aftale."
}

Regler:
- Priser i DKK ekskl. moms
- beloeb = antal * enhedspris (altid)
- Gyldighed: 20 arbejdsdage (AB18 standard)
- Vær realistisk med mængder og priser baseret på ovenstående beskrivelse
- Skriv alt på dansk`;

  const raw = await callClaude(
    token,
    system,
    `Firma: ${company.navn} (${fag})\n\nJobbeskrivelse:\n${JSON.stringify(jobbeskrivelse, null, 2)}`,
    2500
  );
  return JSON.parse(raw);
}

// ── Step 4: Tilbud → Projektplan ─────────────────────────────────────────────
export async function generateProjektplan(token, jobbeskrivelse, tilbud, fag = 'andet') {
  const system = `Du er en erfaren projektleder for håndværksfirmaer (${fag}) i Danmark.

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
  "forudsaetninger": [
    "Forudsætning 1 — fx adgang til ejendommen",
    "Forudsætning 2"
  ]
}

Skriv alt på dansk. Vær konkret, realistisk og fagspecifik for ${fag}.`;

  const raw = await callClaude(
    token,
    system,
    `Fag: ${fag}\nJobbeskrivelse: ${jobbeskrivelse.titel}\n${jobbeskrivelse.beskrivelse}\n\nTilbudslinjer:\n${tilbud.linjer.map(l => `- ${l.beskrivelse} (${l.antal} ${l.enhed})`).join('\n')}`,
    1500
  );
  return JSON.parse(raw);
}
