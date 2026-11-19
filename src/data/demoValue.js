// Value classes for the demo flow (same step ids in English and Danish), so the
// value view works in the demo without calling Ailean.
const CLASSES = [
  ['act_1', 'nnva', null,             'Invoices must be received and registered, but the supplier gains nothing from it.', 'Fakturaer skal modtages og registreres, men leverandøren får intet ud af det.'],
  ['act_2', 'nnva', null,             'Required by internal control. Keep it, but let the system match automatically.', 'Kræves af intern kontrol. Behold det, men lad systemet matche automatisk.'],
  ['act_3', 'waste', 'defects',       'Chasing missing documents is rework caused by incomplete invoices.', 'At jagte manglende dokumenter er omarbejde på grund af ufuldstændige fakturaer.'],
  ['act_4', 'waste', 'defects',       'Rejections exist because errors are caught late. Prevent them at the source.', 'Afvisninger skyldes, at fejl fanges sent. Forebyg dem ved kilden.'],
  ['act_5', 'va', null,               'Correct coding is what makes the invoice payable and the books right.', 'Korrekt kontering gør fakturaen betalbar og regnskabet rigtigt.'],
  ['act_6', 'waste', 'transport',     'A hand-off that only moves the invoice to the next inbox.', 'En overdragelse, der kun flytter fakturaen til næste indbakke.'],
  ['act_7', 'nnva', null,             'Approval is a control requirement. Make it quick with clear limits.', 'Godkendelse er et kontrolkrav. Gør den hurtig med klare beløbsgrænser.'],
  ['act_8', 'waste', 'overprocessing','A second approval layer that rarely changes the outcome.', 'Et ekstra godkendelseslag, der sjældent ændrer udfaldet.'],
  ['act_9', 'va', null,               'Posting the entry completes the record the business relies on.', 'Bogføringen fuldender den post, virksomheden er afhængig af.'],
  ['act_10', 'va', null,              'Paying the supplier on time is the outcome the process exists for.', 'At betale leverandøren til tiden er det, processen findes for.'],
  ['act_11', 'nnva', null,            'Batch authorisation is a payment control. Keep it light.', 'Godkendelse af betalingsbatch er en betalingskontrol. Hold den let.'],
  ['act_12', 'nnva', null,            'Clean-up is needed for accurate records but adds no value for the supplier.', 'Oprydning er nødvendig for korrekte poster, men skaber ingen værdi for leverandøren.'],
];

export function demoValueSuggestions(lang = 'en') {
  return CLASSES.map(([id, cls, waste_type, en, da]) => ({ id, class: cls, waste_type: waste_type || undefined, reason: lang === 'da' ? da : en }));
}
