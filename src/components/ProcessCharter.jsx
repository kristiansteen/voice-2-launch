import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import { charterProgress } from '../lib/charter.js';

// Process charter (B04): problem, customer, owner, KPI baseline → target, volume.
// Same object as the business case inputs, so Plan and the exports use it too.
export default function ProcessCharter({ inputs = {}, onChange }) {
  const { t } = useLang();
  const { filled, total } = charterProgress(inputs);
  const [open, setOpen] = useState(filled < total);
  const set = patch => onChange?.({ ...inputs, ...patch });
  const num = v => (v === '' ? null : Number(v));
  const field = 'mt-1 w-full text-sm text-ink border border-line rounded-md px-3 py-1.5 bg-white focus:outline-none focus:border-ink';
  const label = 'text-xs font-semibold text-mid uppercase tracking-wide';

  return (
    <section className="border border-line rounded-[10px] bg-panel">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block text-sm font-medium text-ink">{t.chTitle}</span>
          <span className="block text-xs text-mid">{t.chSub}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-mid tabular-nums">{filled}/{total}</span>
          <span aria-hidden="true" className="text-mid">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={label}>{t.chOwner}</span>
            <input value={inputs.owner || ''} onChange={e => set({ owner: e.target.value })} placeholder={t.chOwnerPh} className={field} /></label>
          <label className="block"><span className={label}>{t.chCustomer}</span>
            <input value={inputs.customer || ''} onChange={e => set({ customer: e.target.value })} placeholder={t.chCustomerPh} className={field} /></label>
          <label className="block sm:col-span-2"><span className={label}>{t.bcProblem}</span>
            <textarea rows={2} value={inputs.problem || ''} onChange={e => set({ problem: e.target.value })} placeholder={t.bcProblemPh} className={`${field} resize-y`} /></label>
          <label className="block sm:col-span-2"><span className={label}>{t.bcTarget}</span>
            <textarea rows={2} value={inputs.target || ''} onChange={e => set({ target: e.target.value })} placeholder={t.bcTargetPh} className={`${field} resize-y`} /></label>
          <label className="block sm:col-span-2"><span className={label}>{t.chKpi}</span>
            <input value={inputs.kpiName || ''} onChange={e => set({ kpiName: e.target.value })} placeholder={t.chKpiPh} className={field} /></label>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <label className="block"><span className={label}>{t.chBaseline}</span>
              <input type="number" value={inputs.kpiBaseline ?? ''} onChange={e => set({ kpiBaseline: num(e.target.value) })} className={`${field} tabular-nums`} /></label>
            <label className="block"><span className={label}>{t.chTargetValue}</span>
              <input type="number" value={inputs.kpiTarget ?? ''} onChange={e => set({ kpiTarget: num(e.target.value) })} className={`${field} tabular-nums`} /></label>
            <label className="block"><span className={label}>{t.chBy}</span>
              <input type="date" value={inputs.targetDate || ''} onChange={e => set({ targetDate: e.target.value })} className={field} /></label>
          </div>
          <label className="block"><span className={label}>{t.bcVolume}</span>
            <input type="number" min="0" value={inputs.volumePerMonth ?? ''} onChange={e => set({ volumePerMonth: num(e.target.value) })} placeholder="400" className={`${field} tabular-nums`} /></label>
          <p className="text-xs text-mid sm:col-span-2">{t.chShared}</p>
        </div>
      )}
    </section>
  );
}
