// Every export the diagram offers, in menu order. A new format is one entry here,
// its two strings in translations.js, and a handler in DiagramPanel's exportHandlers.
export const EXPORT_FORMATS = [
  { id: 'bpmn',  labelKey: 'exportBpmn',  hintKey: 'exportBpmnHint',  ext: '.xml' },
  { id: 'sop',   labelKey: 'exportSop',   hintKey: 'exportSopHint',   ext: '.html' },
  { id: 'quick', labelKey: 'exportQuick', hintKey: 'exportQuickHint', ext: '.md' },
  { id: 'n8n',   labelKey: 'exportN8n',   hintKey: 'exportN8nHint',   ext: '.json' },
];
