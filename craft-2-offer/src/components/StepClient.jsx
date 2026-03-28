export default function StepClient({ data, update, onNext, onBack }) {
  const c = data.client;
  const set = (k, v) => update('client', { [k]: v });
  const valid = c.name;

  return (
    <div>
      <h2 className="text-xl font-semibold text-aison mb-1">Kunden</h2>
      <p className="text-sm text-gray-400 mb-6">Hvem sender du tilbuddet til?</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Virksomhed / navn *</label>
          <input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Kunde ApS" />
        </div>
        <div className="col-span-2">
          <label className="label">Att.</label>
          <input className="input" value={c.attention} onChange={(e) => set('attention', e.target.value)} placeholder="Kontaktperson" />
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input className="input" value={c.address} onChange={(e) => set('address', e.target.value)} placeholder="Nørregade 5" />
        </div>
        <div>
          <label className="label">By & postnr.</label>
          <input className="input" value={c.city} onChange={(e) => set('city', e.target.value)} placeholder="8000 Aarhus C" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" type="email" value={c.email} onChange={(e) => set('email', e.target.value)} placeholder="info@kunde.dk" />
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button className="btn-secondary" onClick={onBack}>← Tilbage</button>
        <button className="btn-primary" onClick={onNext} disabled={!valid}>Næste →</button>
      </div>
    </div>
  );
}
