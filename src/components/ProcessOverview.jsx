import { useMemo, useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import { APQC_NODES } from '../data/apqcTaxonomy.js';
import { MSBPC_NODES } from '../data/msbpcTaxonomy.js';
import { STAGES, flowStage, flowBusinessCase, summarisePortfolio, groupPortfolio, taxonomyCoverage, makeResolver, defaultOpenAreas, areaKey } from '../lib/portfolio.js';
import { formatMoney } from '../lib/businessCase.js';
import { BeforeAfter } from './BusinessCase.jsx';

// Process overview: portfolio figures → areas (taxonomy level 1) → level 2 → process,
// with the selected process in a panel beside the list.

const STAGE_FILL = {
  describe: ['#E2E2DD', '#151515'], review: ['#C6C6C0', '#151515'], map: ['#A3A39C', '#151515'],
  improve: ['#7E7E78', '#FFFFFF'], plan: ['#62625D', '#FFFFFF'], launched: ['#151515', '#FFFFFF'],
};
const STATUS_DOT = { green: 'bg-ink', amber: 'bg-signal', red: 'bg-red-600' };

function readCustomTaxonomy() {
  try { return JSON.parse(localStorage.getItem('voice2bpmn_custom_taxonomy') || '[]'); } catch { return []; }
}
function activeTaxonomy() {
  const src = (() => { try { return localStorage.getItem('voice2bpmn_taxonomy_source') || 'apqc'; } catch { return 'apqc'; } })();
  if (src === 'msbpc') return { name: 'MS BPC', nodes: MSBPC_NODES };
  if (src === 'custom') {
    const nodes = readCustomTaxonomy();
    if (nodes.length) {
      let name = 'Custom';
      try { name = localStorage.getItem('voice2bpmn_custom_taxonomy_name') || name; } catch { /* keep */ }
      return { name, nodes };
    }
  }
  return { name: 'APQC PCF', nodes: APQC_NODES };
}

function EstTag({ t }) {
  return <span className="ml-1.5 border border-dashed border-mid rounded-full px-1.5 text-[11px] text-mid align-middle">{t.dashEffEst}</span>;
}

function Status({ value, t }) {
  const label = { green: t.dashRagOnTrack, amber: t.dashRagAtRisk, red: t.dashRagOffTrack }[value] || t.ovStatusNone;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap">
      <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[value] || 'border border-mid'}`} />
      <span className={value ? 'text-ink' : 'text-mid'}>{label}</span>
    </span>
  );
}

function BenefitBar({ value, max, currency, lang, est, t }) {
  if (value == null) return <span className="text-mid">—</span>;
  const w = max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[110px] shrink-0 h-2.5 flex" aria-hidden="true">
        <span className="bg-ink rounded-r-[4px]" style={{ width: `${w}%` }} />
      </span>
      <span className="tabular-nums whitespace-nowrap">{formatMoney(value, currency, lang, { compact: true })}</span>
      {est && <EstTag t={t} />}
    </div>
  );
}

function relTime(iso, t) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return t.dashJustNow;
  if (days < 7) return t.dashDaysAgo.replace('{n}', days);
  const weeks = Math.floor(days / 7);
  return weeks < 5 ? t.dashWeeksAgo.replace('{n}', weeks) : new Date(iso).toLocaleDateString();
}

// ── Selected process ──────────────────────────────────────────────────────────
function ProcessPanel({ flow, path, onClose, onOpen, onUpdateRag, onDelete, t, lang }) {
  const bc = useMemo(() => flowBusinessCase(flow), [flow]);
  const selected = (flow.improvements || []).filter(i => (flow.selectedImprovementIds || []).includes(i.id));
  const topImps = (selected.length ? selected : flow.improvements || []).slice(0, 3);
  const topRisks = [...(flow.projectPlan?.risks || [])]
    .sort((a, b) => (b.probability * b.consequence) - (a.probability * a.consequence)).slice(0, 2);
  const plan = flow.projectPlan;
  const hasMoney = bc?.netSavingPerYear != null;
  const nf = n => n.toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB');
  return (
    <aside aria-label={t.ovSelected} className="bg-white border border-line rounded-[10px] p-6 lg:sticky lg:top-6">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          {path && <p className="text-xs text-mid truncate">{path}</p>}
          <h3 className="mt-1 text-[22px] font-medium tracking-[-0.015em] leading-tight">{flow.process_name || t.ovUntitled}</h3>
          <p className="mt-1 text-[13px] text-mid">{t[`ovStage_${flowStage(flow)}`]}{flow.updated_at ? ` · ${relTime(flow.updated_at, t)}` : ''}</p>
        </div>
        <button onClick={onClose} aria-label={t.ovClose} className="w-8 h-8 shrink-0 grid place-items-center rounded-full border border-line hover:border-ink text-ink">✕</button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-[13px] text-mid">
        {t.dashColStatus}
        <select value={flow.ragStatus || ''} onChange={e => onUpdateRag(flow.id, e.target.value || null)}
          className="text-[13px] text-ink border border-line rounded-full px-3 py-1 bg-white focus:outline-none focus:border-ink">
          <option value="">{t.ovStatusNone}</option>
          <option value="green">{t.dashRagOnTrack}</option>
          <option value="amber">{t.dashRagAtRisk}</option>
          <option value="red">{t.dashRagOffTrack}</option>
        </select>
      </label>

      <dl className="mt-5 grid grid-cols-3 border-t border-ink">
        {[
          [hasMoney ? formatMoney(bc.netSavingPerYear, bc.currency, lang, { compact: true }) : '—', t.ovNetPerYearShort, hasMoney && bc.basedOnEstimates],
          [bc?.paybackMonths != null ? `${bc.paybackMonths}` : '—', t.bcPayback],
          [bc?.fteFreed != null ? nf(bc.fteFreed) : '—', t.ovFteFreed],
        ].map(([n, label, est], i) => (
          <div key={i} className={`pt-3 ${i ? 'pl-3 border-l border-line' : 'pr-3'}`}>
            <dd className="text-[22px] font-medium tracking-[-0.03em] leading-none">{n}</dd>
            <dt className="text-xs text-mid mt-1">{label}{est && <EstTag t={t} />}</dt>
          </div>
        ))}
      </dl>
      {!hasMoney && <p className="mt-2 text-xs text-mid">{bc ? t.ovNoMoney : t.ovNoTimes}</p>}

      {bc && (
        <div className="mt-5">
          <BeforeAfter title={t.bcTouchPerCase} asIs={bc.perCase.asIs.touchMin} toBe={bc.perCase.toBe.touchMin} reduction={bc.touchReduction} t={t} />
        </div>
      )}

      {topImps.length > 0 && (
        <>
          <h4 className="mt-5 mb-1 text-[13px] font-semibold">{t.ovTopImprovements}</h4>
          <ul className="text-sm">{topImps.map(i => <li key={i.id} className="py-2 border-t border-case">{i.title}</li>)}</ul>
        </>
      )}
      {topRisks.length > 0 && (
        <>
          <h4 className="mt-4 mb-1 text-[13px] font-semibold">{t.ovTopRisks}</h4>
          <ul className="text-sm">{topRisks.map((r, i) => <li key={r.id || i} className="py-2 border-t border-case">{r.description || r.title || r.name}</li>)}</ul>
        </>
      )}
      {plan && (
        <p className="mt-4 text-[13px] text-mid">
          {t.ovPlanLine.replace('{w}', plan.duration_weeks ?? '—').replace('{n}', (plan.tasks || []).length).replace('{k}', (plan.tracks || []).length)}
          {flow.board_url && <> · <a href={flow.board_url} target="_blank" rel="noopener noreferrer" className="underline">{t.ovBoard}</a></>}
        </p>
      )}

      <button onClick={() => onOpen(flow.id)} className="mt-5 w-full min-h-[44px] rounded-full bg-ink text-paper font-medium hover:bg-ink-hover">{t.ovOpenFlow}</button>
      <button onClick={() => onDelete(flow)} className="mt-2 w-full text-xs text-mid hover:text-red-600 py-1">{t.ovDeleteFlow}</button>
    </aside>
  );
}

// ── Classify an unclassified process ──────────────────────────────────────────
function ClassifySelect({ flow, nodes, onClassify, t }) {
  const l1s = nodes.filter(n => n.level === 1);
  return (
    <select
      aria-label={`${t.ovClassify}: ${flow.process_name || t.ovUntitled}`}
      value=""
      onClick={e => e.stopPropagation()}
      onChange={e => { const n = nodes.find(x => x.id === e.target.value); if (n) onClassify(flow.id, n); }}
      className="text-[13px] font-medium text-ink border border-ink rounded-full px-3 py-1 bg-transparent max-w-[200px]"
    >
      <option value="">{t.ovClassify}</option>
      {l1s.map(l1 => (
        <optgroup key={l1.id} label={`${l1.id} ${l1.name}`}>
          {nodes.filter(n => n.level === 2 && n.parentId === l1.id).map(n => <option key={n.id} value={n.id}>{n.id} {n.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProcessOverview({ flows, onOpen, onUpdateRag, onDelete, onClassify }) {
  const { t, lang } = useLang();
  const tax = useMemo(activeTaxonomy, []);
  // Resolve against every known taxonomy (active first), so a flow lands under the one it was classified in
  const taxLists = useMemo(() => [tax.nodes, APQC_NODES, MSBPC_NODES, readCustomTaxonomy()].filter((l, i, a) => l.length && a.indexOf(l) === i), [tax]);
  const resolve = useMemo(() => makeResolver(taxLists), [taxLists]);
  const [sortBy, setSortBy] = useState('benefit');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const real = useMemo(() => (flows || []).filter(f => !f._demo), [flows]);
  const shownFlows = useMemo(() => (statusFilter === 'all' ? real : real.filter(f => (f.ragStatus || 'none') === statusFilter)), [real, statusFilter]);
  const summary = useMemo(() => summarisePortfolio(real), [real]);
  const coverage = useMemo(() => taxonomyCoverage(real, tax.nodes), [real, tax]);
  const bcById = useMemo(() => Object.fromEntries(real.map(f => [f.id, flowBusinessCase(f)])), [real]);
  const areas = useMemo(() => groupPortfolio(shownFlows, taxLists, { sortBy }), [shownFlows, taxLists, sortBy]);
  // null = the default: everything open for a small portfolio, level 1 only above 7 processes
  const [openSet, setOpenSet] = useState(null);
  const current = openSet ?? defaultOpenAreas(areas, real.length);
  const isOpen = key => current.has(key);
  const toggle = key => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    setOpenSet(next);
  };

  const selected = shownFlows.find(f => f.id === selectedId) || null;
  const pathOf = f => {
    const r = resolve(f.processContext);
    return r.leaf ? `${r.path.join(' › ')} ${r.leaf.name}` : '';
  };

  const mixed = summary.currency === 'mixed';
  const cur = mixed ? 'DKK' : summary.currency;
  const nf = n => n.toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB');
  const maxBenefit = Math.max(0, ...areas.map(a => a.totals.netPerYear || 0));
  const maxFlowBenefit = Math.max(0, ...real.map(f => bcById[f.id]?.netSavingPerYear || 0));
  const TH = 'text-left text-[13px] font-normal text-mid pb-2.5 pr-4 border-b border-ink';
  const TD = 'py-3.5 pr-4 border-b border-line text-sm align-middle';

  const processRow = (f, indent) => {
    const bc = bcById[f.id];
    const sel = f.id === selectedId;
    return (
      <tr key={f.id} className={sel ? 'bg-white shadow-[inset_3px_0_0_#E8500A]' : 'hover:bg-white/60'}>
        <th scope="row" className={`${TD} text-left font-medium ${indent}`}>
          <button onClick={() => setSelectedId(sel ? null : f.id)} aria-pressed={sel} className="text-left text-ink hover:underline">
            {f.process_name || t.ovUntitled}
          </button>
        </th>
        <td className={`${TD} text-mid`}>{t[`ovStage_${flowStage(f)}`]}</td>
        <td className={TD}><BenefitBar value={bc?.netSavingPerYear ?? null} max={maxFlowBenefit} currency={bc?.currency || cur} lang={lang} est={bc?.basedOnEstimates} t={t} /></td>
        <td className={`${TD} tabular-nums`}>{bc?.paybackMonths != null ? t.ovMonths.replace('{n}', bc.paybackMonths) : '—'}</td>
        <td className={`${TD} pr-0`}>
          {resolve(f.processContext).l1 || !onClassify
            ? <Status value={f.ragStatus} t={t} />
            : <ClassifySelect flow={f} nodes={tax.nodes} onClassify={onClassify} t={t} />}
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* Portfolio figures */}
      <section aria-label={t.ovPortfolio} className="grid grid-cols-2 lg:grid-cols-4 border-t border-ink">
        {[
          [summary.netPerYear != null && !mixed ? formatMoney(summary.netPerYear, cur, lang, { compact: true }) : '—', t.ovNetPerYear, summary.basedOnEstimates && summary.netPerYear != null],
          [summary.hours != null ? `${nf(summary.hours)} ${t.bcHourShort}` : '—', t.ovHoursFreed.replace('{fte}', summary.fte != null ? nf(summary.fte) : '—')],
          [summary.oneOff != null && !mixed ? formatMoney(summary.oneOff, cur, lang, { compact: true }) : '—', t.ovOneOff],
          [summary.paybackMonths != null ? t.ovMonths.replace('{n}', summary.paybackMonths) : '—', t.ovPayback],
        ].map(([n, label, est], i) => (
          <div key={i} className={`py-5 ${i ? 'pl-6 border-l border-line' : 'pr-6'} ${i === 2 ? 'max-lg:border-l-0 max-lg:pl-0' : ''}`}>
            <dd className="text-[40px] sm:text-[44px] font-medium tracking-[-0.035em] leading-none">{n}</dd>
            <dt className="text-[13px] text-mid mt-1.5">{label}{est && <EstTag t={t} />}</dt>
          </div>
        ))}
      </section>
      <p className="text-xs text-mid mt-1">
        {mixed ? t.ovMixedCurrency : t.ovMoneyFrom.replace('{n}', summary.withMoney).replace('{m}', summary.count)}
      </p>

      {/* Pipeline and coverage */}
      <section aria-label={t.ovPipeline} className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-end">
        <div>
          <p className="text-[13px] text-mid mb-2">{t.ovPipeline}</p>
          <div role="img" aria-label={STAGES.map(s => `${t[`ovStage_${s}`]} ${summary.stages[s]}`).join(', ')} className="flex gap-0.5 h-7">
            {STAGES.filter(s => summary.stages[s] > 0).map(s => (
              <div key={s} title={`${t[`ovStage_${s}`]}: ${summary.stages[s]}`} style={{ flex: summary.stages[s], background: STAGE_FILL[s][0], color: STAGE_FILL[s][1] }}
                className="rounded-[4px] px-2.5 flex items-center text-xs font-semibold tabular-nums">{summary.stages[s]}</div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-mid">
            {STAGES.map(s => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm border border-line" style={{ background: STAGE_FILL[s][0] }} />
                {t[`ovStage_${s}`]} <span className="tabular-nums text-ink">{summary.stages[s]}</span>
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] text-mid mb-2">{t.ovCoverage.replace('{n}', coverage.covered).replace('{m}', coverage.total).replace('{tax}', tax.name)}</p>
          <div aria-hidden="true" className="flex gap-[3px] flex-wrap">
            {(() => {
              const coveredIds = new Set(real.map(f => makeResolver(tax.nodes)(f.processContext).l1?.id).filter(Boolean));
              return tax.nodes.filter(n => n.level === 1).map(n => (
                <span key={n.id} title={`${n.id} ${n.name}`} className={`w-[18px] h-2 rounded-sm ${coveredIds.has(n.id) ? 'bg-ink' : 'bg-case'}`} />
              ));
            })()}
          </div>
          {coverage.unclassified > 0 && <p className="mt-2 text-xs text-mid">{t.ovUnclassifiedCount.replace('{n}', coverage.unclassified)}</p>}
        </div>
      </section>

      {/* Areas → processes, with the selected process beside */}
      <div className={`mt-12 grid gap-8 items-start ${selected ? 'lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]' : ''}`}>
        <section aria-labelledby="ov-areas">
          <div className="flex justify-between items-baseline gap-3 flex-wrap mb-3">
            <h2 id="ov-areas" className="text-[22px] font-medium tracking-[-0.015em]">{t.ovByArea}</h2>
            <div className="flex gap-3 flex-wrap">
              <label className="text-[13px] text-mid flex gap-1.5 items-center">{t.ovSort}
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[13px] text-ink border border-line rounded-full px-3 py-1 bg-white">
                  <option value="benefit">{t.ovSortBenefit}</option>
                  <option value="status">{t.dashColStatus}</option>
                  <option value="updated">{t.ovSortUpdated}</option>
                </select>
              </label>
              <label className="text-[13px] text-mid flex gap-1.5 items-center">{t.dashColStatus}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-[13px] text-ink border border-line rounded-full px-3 py-1 bg-white">
                  <option value="all">{t.impFilterAll}</option>
                  <option value="green">{t.dashRagOnTrack}</option>
                  <option value="amber">{t.dashRagAtRisk}</option>
                  <option value="red">{t.dashRagOffTrack}</option>
                  <option value="none">{t.ovStatusNone}</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} pl-3 w-[36%]`}>{t.ovColArea}</th>
                  <th scope="col" className={TH}>{t.ovColStage}</th>
                  <th scope="col" className={TH}>{t.ovNetPerYear}</th>
                  <th scope="col" className={TH}>{t.ovPayback}</th>
                  <th scope="col" className={`${TH} pr-0`}>{t.dashColStatus}</th>
                </tr>
              </thead>
              {areas.map(a => {
                const key = areaKey(a);
                const expanded = isOpen(key);
                return (
                  <tbody key={key}>
                    <tr className="bg-panel">
                      <th scope="row" className={`${TD} pl-3 text-left`}>
                        <button onClick={() => toggle(key)} aria-expanded={expanded} className="flex items-center gap-2.5 text-left text-[15px] font-semibold text-ink">
                          <span aria-hidden="true" className="w-3.5 text-mid">{expanded ? '▾' : '▸'}</span>
                          {a.node ? <><span className="text-mid font-medium tabular-nums">{a.node.id}</span>{a.node.name}</> : <span className="text-mid font-medium">{t.ovNotClassified}</span>}
                        </button>
                      </th>
                      <td className={`${TD} tabular-nums`}>{a.flows.length}</td>
                      <td className={TD}><BenefitBar value={a.totals.netPerYear} max={maxBenefit} currency={a.totals.currency === 'mixed' ? cur : a.totals.currency} lang={lang} est={a.totals.basedOnEstimates} t={t} /></td>
                      <td className={`${TD} tabular-nums`}>{a.totals.paybackMonths != null ? t.ovMonths.replace('{n}', a.totals.paybackMonths) : '—'}</td>
                      <td className={`${TD} pr-0`}>
                        {a.status ? <span className="inline-flex items-center gap-1 whitespace-nowrap"><Status value={a.status} t={t} /><span className="text-xs text-mid">· {a.flows.filter(f => f.ragStatus === a.status).length}/{a.flows.length}</span></span> : <Status value={null} t={t} />}
                      </td>
                    </tr>
                    {expanded && a.groups.map(g => (
                      [
                        g.node && (
                          <tr key={`g-${g.node.id}`}>
                            <td colSpan={5} className="pt-3 pb-1.5 pl-[50px] text-xs text-mid border-b border-case">
                              <span className="tabular-nums">{g.node.id}</span>  {g.node.name}
                            </td>
                          </tr>
                        ),
                        ...g.flows.map(f => processRow(f, 'pl-[50px]')),
                      ]
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
          {areas.length === 0 && <p className="text-sm text-mid mt-4">{t.ovNoMatch}</p>}
          <p className="mt-3.5 text-xs text-mid">{t.ovHint}</p>
        </section>
        {selected && (
          <ProcessPanel flow={selected} path={pathOf(selected)} onClose={() => setSelectedId(null)}
            onOpen={onOpen} onUpdateRag={onUpdateRag} onDelete={onDelete} t={t} lang={lang} />
        )}
      </div>
    </div>
  );
}
