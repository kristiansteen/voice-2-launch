import { useState, useEffect } from 'react';
import { parseInterviewToJobDesc } from '../services/claudeService.js';

export default function JobbeskrivelsePanel({ offer, updateOffer, setStep, token, company }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const job = offer.jobbeskrivelse;

  useEffect(() => {
    if (!job && offer.interviewText) {
      generate();
    }
  }, []);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const result = await parseInterviewToJobDesc(token, offer.interviewText, company?.fag);
      updateOffer({ jobbeskrivelse: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateJob(patch) {
    updateOffer({ jobbeskrivelse: { ...job, ...patch } });
  }

  function updateKunde(patch) {
    updateOffer({ jobbeskrivelse: { ...job, kunde: { ...job.kunde, ...patch } } });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Analyserer samtalen...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={generate} className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060]">
          Generer jobbeskrivelse
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Jobbeskrivelse</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gennemgå og ret oplysningerne.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
            Regenerer
          </button>
          <button onClick={() => setEditing(!editing)}
            className="text-xs px-3 py-1.5 border border-[#1B4F72] text-[#1B4F72] rounded-lg hover:bg-blue-50 transition-colors">
            {editing ? 'Luk redigering' : 'Rediger'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Job title */}
        <div className="bg-blue-50 rounded-xl p-4">
          {editing ? (
            <input value={job.titel} onChange={e => updateJob({ titel: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
          ) : (
            <h3 className="text-base font-semibold text-gray-900">{job.titel}</h3>
          )}
        </div>

        {/* Job description */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Beskrivelse</label>
          {editing ? (
            <textarea value={job.beskrivelse} onChange={e => updateJob({ beskrivelse: e.target.value })}
              rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.beskrivelse}</p>
          )}
        </div>

        {/* Address & scope */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Arbejdssted</label>
            {editing ? (
              <input value={job.adresse} onChange={e => updateJob({ adresse: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
            ) : (
              <p className="text-sm text-gray-700">{job.adresse || '—'}</p>
            )}
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Startdato</label>
            {editing ? (
              <input value={job.startdato} onChange={e => updateJob({ startdato: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
            ) : (
              <p className="text-sm text-gray-700">{job.startdato || '—'}</p>
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kundeoplysninger</label>
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              {[['navn', 'Navn'], ['adresse', 'Adresse'], ['postnr', 'Postnr.'], ['by', 'By'], ['telefon', 'Telefon'], ['email', 'Email']].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
                  <input value={job.kunde?.[k] ?? ''} onChange={e => updateKunde({ [k]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-1 text-sm text-gray-700">
              <span className="text-gray-400 text-xs">Navn</span><span>{job.kunde?.navn || '—'}</span>
              <span className="text-gray-400 text-xs">Adresse</span><span>{job.kunde?.adresse || '—'}</span>
              <span className="text-gray-400 text-xs">Postnr/By</span><span>{[job.kunde?.postnr, job.kunde?.by].filter(Boolean).join(' ') || '—'}</span>
              <span className="text-gray-400 text-xs">Telefon</span><span>{job.kunde?.telefon || '—'}</span>
              <span className="text-gray-400 text-xs">Email</span><span>{job.kunde?.email || '—'}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {(job.noter || editing) && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bemærkninger</label>
            {editing ? (
              <textarea value={job.noter} onChange={e => updateJob({ noter: e.target.value })}
                rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B4F72]" />
            ) : (
              <p className="text-sm text-gray-700">{job.noter}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button onClick={() => setStep(0)}
          className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
          ← Tilbage
        </button>
        <button onClick={() => setStep(2)}
          className="px-6 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-semibold hover:bg-[#154060] transition-colors flex items-center gap-2">
          Generer tilbud
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
