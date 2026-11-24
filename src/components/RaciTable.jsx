import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import { buildRaci, nextLetter, raciIssues, raciCsv, setCell } from '../lib/raci.js';

const CELL = {
  '': 'text-gray-300 border-gray-100',
  R: 'bg-gray-100 text-ink border-gray-200',
  A: 'bg-ink text-white border-ink',
  'A/R': 'bg-ink text-white border-ink',
  C: 'bg-signal-50 text-signal-700 border-signal-200',
  I: 'bg-white text-mid border-line',
};

// RACI chart in Review (B18): steps × roles, click a cell to change it.
export default function RaciTable({ description, overrides, onChange, onSuggest }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const raci = buildRaci(description, overrides);
  if (!raci.rows.length || !raci.roles.length) return null;
  const issues = raciIssues(raci);
  const problemCount = Object.keys(issues).length;

  async function suggest() {
    setBusy(true); setFailed(false);
    try { if (!(await onSuggest(raci))) setFailed(true); } finally { setBusy(false); }
  }

  function download() {
    const blob = new Blob(['﻿' + raciCsv(raci, t.raciStep)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RACI - ${(description?.process_name || 'process').replace(/[\\/:*?"<>|]/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-2" data-testid="raci">
      <p className="text-[11px] text-mid">{t.raciLegend}</p>
      <div className="overflow-x-auto border border-gray-100 rounded">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left font-medium text-gray-500 px-2 py-1.5 sticky left-0 bg-gray-50">{t.raciStep}</th>
              {raci.roles.map(r => (
                <th key={r} className="font-medium text-gray-600 px-1 py-1.5 text-center align-bottom min-w-[64px]">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raci.rows.map(row => (
              <tr key={row.step} className="border-t border-gray-100">
                <td className="px-2 py-1 sticky left-0 bg-white">
                  <span className="text-gray-700">{row.step}</span>
                  {issues[row.step] && (
                    <span className="block text-[10px] text-signal-700">{issues[row.step].map(i => t.raciIssue[i]).join(' · ')}</span>
                  )}
                </td>
                {raci.roles.map(role => {
                  const v = row.cells[role];
                  return (
                    <td key={role} className="px-1 py-1 text-center">
                      <button
                        onClick={() => onChange(setCell(overrides, row.step, role, nextLetter(v)))}
                        className={`w-10 h-6 rounded border text-[11px] font-semibold transition ${CELL[v]}`}
                        aria-label={`${row.step} · ${role}: ${v || t.raciNone}`}
                      >{v || '·'}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={suggest} disabled={busy} className="text-xs font-medium text-ink underline underline-offset-2 disabled:opacity-50">
          {busy ? t.raciSuggesting : t.raciSuggest}
        </button>
        <button onClick={download} className="text-xs font-medium text-ink underline underline-offset-2">{t.raciCsv}</button>
        {problemCount > 0 && <span className="text-[11px] text-signal-700">{t.raciProblems.replace('{n}', problemCount)}</span>}
        {failed && <span className="text-[11px] text-red-700">{t.raciFailed}</span>}
      </div>
    </div>
  );
}
