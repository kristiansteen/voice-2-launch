import { useState } from 'react';

const UNITS = ['stk', 'time', 'dag', 'md.', 'pakke', 'l', 'kg', 'm²'];

export default function StepItems({ data, update, onNext, onBack }) {
  const { items, meta } = data;
  const [nextId, setNextId] = useState(items.length + 1);

  const setItems = (newItems) => update('items', newItems);

  const addItem = () => {
    setItems([...items, { id: nextId, description: '', qty: 1, unit: 'stk', unitPrice: '' }]);
    setNextId((n) => n + 1);
  };

  const removeItem = (id) => setItems(items.filter((i) => i.id !== id));

  const updateItem = (id, key, value) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [key]: value } : i)));

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.unitPrice) || 0) * (parseFloat(i.qty) || 0), 0);
  const vat = subtotal * 0.25;
  const total = subtotal + vat;

  const fmt = (n) => n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valid = items.length > 0 && items.every((i) => i.description && i.unitPrice);

  return (
    <div>
      <h2 className="text-xl font-semibold text-aison mb-1">Ydelser</h2>
      <p className="text-sm text-gray-400 mb-4">Hvad indeholder tilbuddet?</p>

      {/* Offer meta */}
      <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100">
        <div>
          <label className="label">Tilbudsnummer</label>
          <input
            className="input"
            value={meta.offerNumber}
            onChange={(e) => update('meta', { offerNumber: e.target.value })}
            placeholder="2025-001"
          />
        </div>
        <div>
          <label className="label">Gyldigt i (dage)</label>
          <input
            className="input"
            type="number"
            min="1"
            value={meta.validDays}
            onChange={(e) => update('meta', { validDays: parseInt(e.target.value) || 30 })}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Beskrivelse *"
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              />
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-lg px-1"
                  title="Fjern"
                >
                  ×
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Antal</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.qty}
                  onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Enhed</label>
                <select
                  className="input"
                  value={item.unit}
                  onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Enhedspris (kr.)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="0,00"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                />
              </div>
            </div>
            {item.unitPrice && item.qty && (
              <p className="text-right text-xs text-gray-400">
                = {fmt((parseFloat(item.unitPrice) || 0) * (parseFloat(item.qty) || 0))} kr.
              </p>
            )}
          </div>
        ))}
      </div>

      <button onClick={addItem} className="mt-3 text-sm text-aison-light hover:underline">
        + Tilføj linje
      </button>

      {/* Totals */}
      <div className="mt-6 pt-4 border-t border-gray-100 text-sm space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span><span>{fmt(subtotal)} kr.</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Moms (25%)</span><span>{fmt(vat)} kr.</span>
        </div>
        <div className="flex justify-between font-semibold text-aison text-base pt-1 border-t border-gray-100">
          <span>I alt</span><span>{fmt(total)} kr.</span>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="label">Bemærkninger / betalingsbetingelser</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={meta.notes}
          onChange={(e) => update('meta', { notes: e.target.value })}
          placeholder="f.eks. Betaling netto 14 dage. Priser er ekskl. moms."
        />
      </div>

      <div className="mt-8 flex justify-between">
        <button className="btn-secondary" onClick={onBack}>← Tilbage</button>
        <button className="btn-primary" onClick={onNext} disabled={!valid}>Generer tilbud →</button>
      </div>
    </div>
  );
}
