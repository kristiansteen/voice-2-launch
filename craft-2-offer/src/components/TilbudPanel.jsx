import { useState, useEffect } from 'react';
import { generateTilbud } from '../services/claudeService.js';
import { downloadTilbudPDF } from '../utils/pdfGenerator.js';

function formatDKK(amount) {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const TYPE_LABELS = { arbejdsløn: 'Arbejdsløn', materialer: 'Materialer', udlæg: 'Udlæg/Andet' };

export default function TilbudPanel({ offer, updateOffer, setStep, token, company }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const tilbud = offer.tilbud;

  useEffect(() => {
    if (!tilbud && offer.jobbeskrivelse) {
      generate();
    }
  }, []);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const result = await generateTilbud(token, offer.jobbeskrivelse, company);
      updateOffer({ tilbud: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Beregner tilbud...</p>
      </div>
    );
  }

  if (!tilbud) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={generate} className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060]">
          Generer tilbud
        </button>
      </div>
    );
  }

  const linjer = tilbud.linjer ?? [];
  const subtotal = linjer.reduce((s, l) => s + l.beloeb, 0);
  const moms = subtotal * 0.25;
  const total = subtotal + moms;

  function updateLinje(idx, patch) {
    const next = linjer.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      updated.beloeb = updated.antal * updated.enhedspris;
      return updated;
    });
    updateOffer({ tilbud: { ...tilbud, linjer: next } });
  }

  function addLinje() {
    const next = [...linjer, { type: 'arbejdsløn', beskrivelse: 'Ny post', antal: 1, enhed: 'stk', enhedspris: 0, beloeb: 0 }];
    updateOffer({ tilbud: { ...tilbud, linjer: next } });
    setEditingIdx(next.length - 1);
  }

  function removeLinje(idx) {
    updateOffer({ tilbud: { ...tilbud, linjer: linjer.filter((_, i) => i !== idx) } });
    if (editingIdx === idx) setEditingIdx(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tilbud</h2>
          <p className="text-sm text-gray-500 mt-0.5">Nr. {offer.tilbudsnummer} · Tilbud ekskl. moms</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
            Regenerer
          </button>
          <button
            onClick={() => downloadTilbudPDF(offer, company)}
            className="text-xs px-3 py-1.5 bg-[#F39C12] text-white rounded-lg font-medium hover:bg-[#d68910] transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Line items */}
        <div className="space-y-2 mb-4">
          {linjer.map((linje, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {editingIdx === idx ? (
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <select value={linje.type} onChange={e => updateLinje(idx, { type: e.target.value })}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none">
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input value={linje.beskrivelse} onChange={e => updateLinje(idx, { beskrivelse: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                      placeholder="Beskrivelse" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" value={linje.antal} onChange={e => updateLinje(idx, { antal: parseFloat(e.target.value) || 0 })}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none"
                      placeholder="Antal" />
                    <select value={linje.enhed} onChange={e => updateLinje(idx, { enhed: e.target.value })}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                      {['stk', 'timer', 'm2', 'm', 'ls'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <span className="text-xs text-gray-400">×</span>
                    <input type="number" value={linje.enhedspris} onChange={e => updateLinje(idx, { enhedspris: parseFloat(e.target.value) || 0 })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none"
                      placeholder="Enhedspris" />
                    <span className="text-xs text-gray-400">kr.</span>
                    <button onClick={() => setEditingIdx(null)}
                      className="px-3 py-1.5 bg-[#1B4F72] text-white rounded-lg text-xs font-medium">Gem</button>
                    <button onClick={() => removeLinje(idx)}
                      className="px-2 py-1.5 text-red-400 hover:text-red-600 text-xs">Slet</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setEditingIdx(idx)}>
                  <div className="flex-1">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded mr-2">{TYPE_LABELS[linje.type] ?? linje.type}</span>
                    <span className="text-sm text-gray-800">{linje.beskrivelse}</span>
                    <span className="text-xs text-gray-400 ml-2">{linje.antal} {linje.enhed} × {formatDKK(linje.enhedspris)} kr.</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatDKK(linje.beloeb)} kr.</span>
                </div>
              )}
            </div>
          ))}

          <button onClick={addLinje}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#1B4F72] hover:text-[#1B4F72] transition-colors">
            + Tilføj post
          </button>
        </div>

        {/* Totals */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal ekskl. moms</span>
              <span className="tabular-nums">{formatDKK(subtotal)} kr.</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Moms 25%</span>
              <span className="tabular-nums">{formatDKK(moms)} kr.</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total inkl. moms</span>
              <span className="tabular-nums">{formatDKK(total)} kr.</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <label className="block text-xs text-gray-400 mb-1">Betalingsbetingelser</label>
            <input value={tilbud.betalingsbetingelser ?? 'Netto 14 dage'}
              onChange={e => updateOffer({ tilbud: { ...tilbud, betalingsbetingelser: e.target.value } })}
              className="w-full text-sm text-gray-800 focus:outline-none" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <label className="block text-xs text-gray-400 mb-1">Gyldighed (dage)</label>
            <input type="number" value={tilbud.gyldighedsdage ?? 30}
              onChange={e => updateOffer({ tilbud: { ...tilbud, gyldighedsdage: parseInt(e.target.value) || 30 } })}
              className="w-full text-sm text-gray-800 focus:outline-none" />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-100 rounded-xl p-3 mt-3">
          <label className="block text-xs text-gray-400 mb-1">Bemærkninger til tilbud</label>
          <textarea value={tilbud.noter ?? ''}
            onChange={e => updateOffer({ tilbud: { ...tilbud, noter: e.target.value } })}
            rows={2}
            className="w-full text-sm text-gray-800 resize-none focus:outline-none"
            placeholder="Eventuelle forbehold, aftaler eller betingelser..." />
        </div>
      </div>

      <div className="mt-4 flex justify-between">
        <button onClick={() => setStep(1)}
          className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          ← Tilbage
        </button>
        <div className="flex gap-2">
          <button onClick={() => downloadTilbudPDF(offer, company)}
            className="px-4 py-2.5 bg-[#F39C12] text-white rounded-xl text-sm font-semibold hover:bg-[#d68910] transition-colors">
            Download PDF
          </button>
          <button onClick={() => setStep(3)}
            className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060] transition-colors flex items-center gap-2">
            Projektplan
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
