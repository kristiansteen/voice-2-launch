export default function StepCompany({ data, update, onNext }) {
  const c = data.company;
  const set = (k, v) => update('company', { [k]: v });
  const valid = c.name && c.email;

  return (
    <div>
      <h2 className="text-xl font-semibold text-aison mb-1">Din virksomhed</h2>
      <p className="text-sm text-gray-400 mb-6">Oplysninger der vises som afsender på tilbuddet</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Virksomhedsnavn *</label>
          <input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Aison ApS" />
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input className="input" value={c.address} onChange={(e) => set('address', e.target.value)} placeholder="Vestergade 12" />
        </div>
        <div>
          <label className="label">By & postnr.</label>
          <input className="input" value={c.city} onChange={(e) => set('city', e.target.value)} placeholder="2100 København Ø" />
        </div>
        <div>
          <label className="label">CVR-nr.</label>
          <input className="input" value={c.cvr} onChange={(e) => set('cvr', e.target.value)} placeholder="12345678" />
        </div>
        <div>
          <label className="label">E-mail *</label>
          <input className="input" type="email" value={c.email} onChange={(e) => set('email', e.target.value)} placeholder="kontakt@aison.dk" />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input className="input" value={c.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+45 12 34 56 78" />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button className="btn-primary" onClick={onNext} disabled={!valid}>
          Næste →
        </button>
      </div>
    </div>
  );
}
