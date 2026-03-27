import { useState } from 'react';

export default function CompanySetup({ company, onSave }) {
  const [form, setForm] = useState({ ...company });
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.navn || !form.cvr || !form.email) {
      setError('Udfyld venligst firmanavn, CVR og email.');
      return;
    }
    onSave(form);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B4F72] to-[#2E86C1] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Opsæt din virksomhed</h2>
          <p className="text-sm text-gray-500 mt-1">Disse oplysninger vises på dine tilbud. Du kan altid ændre dem senere.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Firmanavn *</label>
              <input name="navn" value={form.navn} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="Hansen El ApS" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CVR-nummer *</label>
              <input name="cvr" value={form.cvr} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="12345678" maxLength={8} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
              <input name="telefon" value={form.telefon} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="+45 12 34 56 78" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
              <input name="adresse" value={form.adresse} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="Industrivej 12" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Postnr.</label>
              <input name="postnr" value={form.postnr} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="2100" maxLength={4} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">By</label>
              <input name="by" value={form.by} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="København Ø" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="info@hansanel.dk" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Fag *</label>
              <select name="fag" value={form.fag} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]">
                <option value="elektriker">Elektriker</option>
                <option value="vvs">VVS-installatør</option>
                <option value="tømrer">Tømrer</option>
                <option value="maler">Maler</option>
                <option value="murer">Murer</option>
                <option value="tagdækker">Tagdækker</option>
                <option value="andet">Andet håndværk</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Hjemmeside</label>
              <input name="hjemmeside" value={form.hjemmeside} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                placeholder="www.hansanel.dk" />
            </div>
          </div>

          <button type="submit"
            className="w-full bg-[#1B4F72] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#154060] transition-colors mt-2">
            Gem og fortsæt
          </button>
        </form>
      </div>
    </div>
  );
}
