import { useState, useEffect } from 'react';
import { generateProjektplan } from '../services/claudeService.js';
import { downloadTilbudPDF } from '../utils/pdfGenerator.js';

export default function ProjektplanPanel({ offer, updateOffer, setStep, token, company }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const plan = offer.projektplan;

  useEffect(() => {
    if (!plan && offer.jobbeskrivelse && offer.tilbud) {
      generate();
    }
  }, []);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const result = await generateProjektplan(token, offer.jobbeskrivelse, offer.tilbud);
      updateOffer({ projektplan: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFase(idx, patch) {
    const faser = plan.faser.map((f, i) => i === idx ? { ...f, ...patch } : f);
    updateOffer({ projektplan: { ...plan, faser } });
  }

  function updateOpgave(faseIdx, opgaveIdx, val) {
    const faser = plan.faser.map((f, i) => {
      if (i !== faseIdx) return f;
      return { ...f, opgaver: f.opgaver.map((o, j) => j === opgaveIdx ? val : o) };
    });
    updateOffer({ projektplan: { ...plan, faser } });
  }

  function addOpgave(faseIdx) {
    const faser = plan.faser.map((f, i) => {
      if (i !== faseIdx) return f;
      return { ...f, opgaver: [...f.opgaver, 'Ny opgave'] };
    });
    updateOffer({ projektplan: { ...plan, faser } });
  }

  function removeOpgave(faseIdx, opgaveIdx) {
    const faser = plan.faser.map((f, i) => {
      if (i !== faseIdx) return f;
      return { ...f, opgaver: f.opgaver.filter((_, j) => j !== opgaveIdx) };
    });
    updateOffer({ projektplan: { ...plan, faser } });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Udarbejder projektplan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={generate} className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060]">
          Generer projektplan
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Projektplan</h2>
          <p className="text-sm text-gray-500 mt-0.5">{plan.totalVarighedEstimat}</p>
        </div>
        <button onClick={generate}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          Regenerer
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {plan.faser.map((fase, faseIdx) => (
          <div key={faseIdx} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1B4F72] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {faseIdx + 1}
                </div>
                <div>
                  <input value={fase.navn}
                    onChange={e => updateFase(faseIdx, { navn: e.target.value })}
                    className="text-sm font-semibold text-gray-900 focus:outline-none border-b border-transparent hover:border-gray-300 focus:border-[#1B4F72] bg-transparent w-full"
                  />
                  <input value={fase.varighed}
                    onChange={e => updateFase(faseIdx, { varighed: e.target.value })}
                    className="text-xs text-gray-400 focus:outline-none border-b border-transparent hover:border-gray-300 focus:border-[#1B4F72] bg-transparent w-full mt-0.5"
                    placeholder="Varighed..."
                  />
                </div>
              </div>
            </div>
            <div className="ml-10 space-y-1.5">
              {fase.opgaver.map((opgave, opgaveIdx) => (
                <div key={opgaveIdx} className="flex items-center gap-2 group">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F39C12] flex-shrink-0" />
                  <input value={opgave}
                    onChange={e => updateOpgave(faseIdx, opgaveIdx, e.target.value)}
                    className="flex-1 text-sm text-gray-700 focus:outline-none border-b border-transparent hover:border-gray-200 focus:border-[#1B4F72] bg-transparent"
                  />
                  <button onClick={() => removeOpgave(faseIdx, opgaveIdx)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs px-1 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={() => addOpgave(faseIdx)}
                className="text-xs text-[#2E86C1] hover:text-[#1B4F72] transition-colors mt-1">
                + Tilføj opgave
              </button>
            </div>
          </div>
        ))}

        {/* Assumptions */}
        {plan.forudsaetninger?.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Forudsætninger</h4>
            <ul className="space-y-1">
              {plan.forudsaetninger.map((f, i) => (
                <li key={i} className="text-sm text-amber-800 flex gap-2">
                  <span>•</span><span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center">
        <button onClick={() => setStep(2)}
          className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          ← Tilbage
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => downloadTilbudPDF(offer, company)}
            className="px-4 py-2.5 bg-[#F39C12] text-white rounded-xl text-sm font-semibold hover:bg-[#d68910] transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download tilbud PDF
          </button>
          <button
            onClick={() => { window.location.reload(); }}
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
            Nyt tilbud
          </button>
        </div>
      </div>
    </div>
  );
}
