import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

/**
 * BPMN elicitation question bank.
 * Each category maps to a BPMN concept the question is designed to surface.
 */
const QUESTION_BANK = {
  en: [
    {
      id: 'start',
      icon: '🟢',
      label: 'Start',
      bpmn: 'Start Event',
      questions: [
        { q: 'What triggers this process to start?',       hint: 'Start event / trigger' },
        { q: 'Who initiates it, and under what conditions?', hint: 'Start event + role' },
        { q: 'What is the very first action taken?',        hint: 'First task' },
        { q: 'How does information arrive — email, system, request?', hint: 'Message / signal start' },
      ],
    },
    {
      id: 'flow',
      icon: '➡️',
      label: 'Next step',
      bpmn: 'Sequence Flow / Task',
      questions: [
        { q: 'What happens next?',                                 hint: 'Sequence flow' },
        { q: 'Who is responsible for this step?',                  hint: 'Lane / role' },
        { q: 'What systems or tools are used here?',               hint: 'System annotation' },
        { q: 'How long does this typically take?',                 hint: 'Performance metric' },
        { q: 'Can this step happen in parallel with anything else?', hint: 'Parallel gateway' },
        { q: 'Does anyone else need to be notified at this point?', hint: 'Message flow' },
      ],
    },
    {
      id: 'gateway',
      icon: '🔀',
      label: 'Decisions',
      bpmn: 'Gateway',
      questions: [
        { q: 'Are there any conditions or checks at this point?',   hint: 'Exclusive gateway' },
        { q: 'What are the different possible outcomes here?',      hint: 'Gateway branches' },
        { q: 'What happens if the answer is no?',                  hint: 'Negative branch' },
        { q: 'What criteria determine which path is taken?',        hint: 'Condition expression' },
        { q: 'Can more than one path be taken at the same time?',  hint: 'Inclusive gateway' },
        { q: 'Is there a waiting or approval step before continuing?', hint: 'Intermediate event' },
      ],
    },
    {
      id: 'exception',
      icon: '⚠️',
      label: 'Exceptions',
      bpmn: 'Boundary Event / Error',
      questions: [
        { q: 'What are the typical exceptions to this?',           hint: 'Exception flow' },
        { q: 'What happens when something goes wrong?',            hint: 'Error boundary event' },
        { q: 'Who escalates this, and to whom?',                   hint: 'Escalation event' },
        { q: 'How often does this exception occur?',               hint: 'Frequency / risk' },
        { q: 'Is there a timeout — what happens if nothing occurs?', hint: 'Timer boundary event' },
        { q: 'What is the workaround when the system is unavailable?', hint: 'Compensation' },
      ],
    },
    {
      id: 'roles',
      icon: '👥',
      label: 'Roles',
      bpmn: 'Lane / Pool',
      questions: [
        { q: 'Who approves this decision?',                        hint: 'Approval role' },
        { q: 'Who else is involved at this point?',                hint: 'Additional role' },
        { q: 'Is there a handoff between teams or departments?',   hint: 'Pool boundary / message' },
        { q: 'Does an external party (supplier, customer) interact here?', hint: 'External pool' },
        { q: 'Who is accountable if this step fails?',             hint: 'Ownership' },
      ],
    },
    {
      id: 'data',
      icon: '📄',
      label: 'Data',
      bpmn: 'Data Object / Store',
      questions: [
        { q: 'What information is needed to start this step?',     hint: 'Input data' },
        { q: 'What documents or records are created here?',        hint: 'Data object' },
        { q: 'Where is this data stored or sent?',                 hint: 'Data store' },
        { q: 'Are there any forms or templates involved?',         hint: 'Data object' },
      ],
    },
    {
      id: 'end',
      icon: '🔴',
      label: 'End',
      bpmn: 'End Event',
      questions: [
        { q: 'What are the possible end states of this process?',  hint: 'End event' },
        { q: 'How do you know the process is complete?',           hint: 'Completion criteria' },
        { q: 'What is produced or delivered at the end?',          hint: 'Output / result' },
        { q: 'Are there multiple ways this process can end?',      hint: 'Multiple end events' },
      ],
    },
    {
      id: 'performance',
      icon: '📊',
      label: 'Performance',
      bpmn: 'Metrics / KPIs',
      questions: [
        { q: 'Are there any SLAs or time constraints?',            hint: 'Timer / SLA' },
        { q: 'What are the known bottlenecks or pain points?',     hint: 'Improvement area' },
        { q: 'How many times does this happen per day or week?',   hint: 'Volume metric' },
        { q: 'What does a successful outcome look like?',          hint: 'KPI' },
      ],
    },
  ],

  da: [
    {
      id: 'start',
      icon: '🟢',
      label: 'Start',
      bpmn: 'Starthændelse',
      questions: [
        { q: 'Hvad udløser denne proces?',                         hint: 'Starthændelse / trigger' },
        { q: 'Hvem starter den, og under hvilke betingelser?',     hint: 'Starthændelse + rolle' },
        { q: 'Hvad er den allerførste handling?',                  hint: 'Første opgave' },
        { q: 'Hvordan ankommer informationen — e-mail, system, anmodning?', hint: 'Besked / signal' },
      ],
    },
    {
      id: 'flow',
      icon: '➡️',
      label: 'Næste trin',
      bpmn: 'Sekvensflow / Opgave',
      questions: [
        { q: 'Hvad sker der derefter?',                            hint: 'Sekvensflow' },
        { q: 'Hvem er ansvarlig for dette trin?',                  hint: 'Bane / rolle' },
        { q: 'Hvilke systemer eller værktøjer bruges her?',        hint: 'Systemannotation' },
        { q: 'Hvor lang tid tager dette normalt?',                 hint: 'Performancemål' },
        { q: 'Kan dette trin ske parallelt med noget andet?',      hint: 'Parallelgateway' },
        { q: 'Skal nogen underrettes på dette tidspunkt?',         hint: 'Beskedflow' },
      ],
    },
    {
      id: 'gateway',
      icon: '🔀',
      label: 'Beslutninger',
      bpmn: 'Gateway',
      questions: [
        { q: 'Er der betingelser eller kontroller på dette punkt?', hint: 'Eksklusiv gateway' },
        { q: 'Hvad er de mulige udfald her?',                      hint: 'Gateway-grene' },
        { q: 'Hvad sker der, hvis svaret er nej?',                  hint: 'Negativ gren' },
        { q: 'Hvad bestemmer, hvilken vej der tages?',             hint: 'Betingelsesudtryk' },
        { q: 'Kan mere end én vej tages på samme tid?',            hint: 'Inklusiv gateway' },
        { q: 'Er der et godkendelsestrin, før processen fortsætter?', hint: 'Mellemevent' },
      ],
    },
    {
      id: 'exception',
      icon: '⚠️',
      label: 'Undtagelser',
      bpmn: 'Grænsebegivenhed / Fejl',
      questions: [
        { q: 'Hvad er de typiske undtagelser?',                    hint: 'Undtagelsesflow' },
        { q: 'Hvad sker der, når noget går galt?',                 hint: 'Fejlgrænsebegivenhed' },
        { q: 'Hvem eskalerer dette, og til hvem?',                 hint: 'Eskaleringsbegivenhed' },
        { q: 'Hvor ofte sker denne undtagelse?',                   hint: 'Frekvens / risiko' },
        { q: 'Er der en timeout — hvad sker der, hvis intet sker?', hint: 'Timergrænsebegivenhed' },
        { q: 'Hvad er workaroundén, hvis systemet er utilgængeligt?', hint: 'Kompensation' },
      ],
    },
    {
      id: 'roles',
      icon: '👥',
      label: 'Roller',
      bpmn: 'Bane / Pool',
      questions: [
        { q: 'Hvem godkender denne beslutning?',                   hint: 'Godkendelsesrolle' },
        { q: 'Hvem er ellers involveret på dette tidspunkt?',      hint: 'Yderligere rolle' },
        { q: 'Er der en overdragelse mellem teams eller afdelinger?', hint: 'Poolgrænse / besked' },
        { q: 'Interagerer en ekstern part (leverandør, kunde) her?', hint: 'Ekstern pool' },
        { q: 'Hvem er ansvarlig, hvis dette trin fejler?',         hint: 'Ejerskab' },
      ],
    },
    {
      id: 'data',
      icon: '📄',
      label: 'Data',
      bpmn: 'Dataobjekt / -lager',
      questions: [
        { q: 'Hvilke oplysninger er nødvendige for at starte dette trin?', hint: 'Inputdata' },
        { q: 'Hvilke dokumenter eller poster oprettes her?',       hint: 'Dataobjekt' },
        { q: 'Hvor gemmes eller sendes disse data?',               hint: 'Datalager' },
        { q: 'Er der formularer eller skabeloner involveret?',     hint: 'Dataobjekt' },
      ],
    },
    {
      id: 'end',
      icon: '🔴',
      label: 'Slut',
      bpmn: 'Slutbegivenhed',
      questions: [
        { q: 'Hvad er de mulige slutresultater?',                  hint: 'Slutbegivenhed' },
        { q: 'Hvordan ved du, at processen er fuldført?',          hint: 'Afslutningskriterier' },
        { q: 'Hvad produceres eller leveres til sidst?',           hint: 'Output / resultat' },
        { q: 'Er der flere måder, denne proces kan slutte på?',    hint: 'Flere slutbegivenheder' },
      ],
    },
    {
      id: 'performance',
      icon: '📊',
      label: 'Performance',
      bpmn: 'Målinger / KPI\'er',
      questions: [
        { q: 'Er der SLA\'er eller tidsbegrænsninger?',           hint: 'Timer / SLA' },
        { q: 'Hvad er de kendte flaskehalse eller smertenspunkter?', hint: 'Forbedringsområde' },
        { q: 'Hvor mange gange sker dette om dagen eller ugen?',   hint: 'Volumenmål' },
        { q: 'Hvordan ser et vellykket resultat ud?',              hint: 'KPI' },
      ],
    },
  ],
};

export default function InterviewGuide({ isRecording }) {
  const { lang, t } = useLang();
  const [askedIds, setAskedIds] = useState(new Set());
  const [openCategory, setOpenCategory] = useState('start');

  const categories = QUESTION_BANK[lang] || QUESTION_BANK.en;

  function toggleAsked(id) {
    setAskedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const askedCount = askedIds.size;
  const totalCount = categories.reduce((n, c) => n + c.questions.length, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {t.guideTitle}
        </span>
        <span className="text-xs text-gray-400">{askedCount}/{totalCount} {t.guideAsked}</span>
      </div>

      {isRecording && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border-b border-red-100 shrink-0">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-xs text-red-600">{t.guideRecordingHint}</span>
        </div>
      )}

      {/* Category tabs + questions */}
      <div className="flex-1 overflow-y-auto">
        {categories.map(cat => (
          <div key={cat.id}>
            {/* Category header */}
            <button
              onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{cat.icon}</span>
                <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                <span className="text-xs text-gray-400 hidden sm:inline">· {cat.bpmn}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Badge showing how many asked in this category */}
                {cat.questions.some((_, qi) => askedIds.has(`${cat.id}-${qi}`)) && (
                  <span className="text-xs text-green-600 font-medium">
                    {cat.questions.filter((_, qi) => askedIds.has(`${cat.id}-${qi}`)).length}✓
                  </span>
                )}
                <span className="text-gray-400 text-xs">{openCategory === cat.id ? '▾' : '›'}</span>
              </div>
            </button>

            {/* Questions */}
            {openCategory === cat.id && (
              <div className="bg-gray-50/60">
                {cat.questions.map((item, qi) => {
                  const id = `${cat.id}-${qi}`;
                  const asked = askedIds.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleAsked(id)}
                      className={[
                        'w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 transition-colors group',
                        asked ? 'bg-green-50' : 'hover:bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-2">
                        <span className={[
                          'shrink-0 mt-0.5 text-xs',
                          asked ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400',
                        ].join(' ')}>
                          {asked ? '✓' : '○'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={[
                            'text-xs leading-snug',
                            asked ? 'text-gray-400 line-through' : 'text-gray-700',
                          ].join(' ')}>
                            "{item.q}"
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 italic">{item.hint}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
