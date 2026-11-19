import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import TrustBadge from './TrustBadge.jsx';
import ProcessOverview from './ProcessOverview.jsx';

const PRICING_URL = 'https://ailean.dk/ailean-pricing';

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="h-1.5 bg-gray-100 rounded-full w-full mt-1" />
      <div className="flex gap-1.5 flex-wrap mt-1">
        {[60, 72, 56, 68, 52].map(w => (
          <div key={w} className="h-5 bg-gray-100 rounded-full" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function DeleteModal({ flow, onConfirm, onCancel }) {
  const { t } = useLang();
  const [deleteBoard, setDeleteBoard] = useState(false);
  const hasBoard = !!flow.board_id;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">{t.dashDeleteTitle}</h3>
        <p className="text-xs text-gray-500 mb-4">
          {t.dashDeleteBody.replace('{name}', flow.process_name || t.dashUntitledProcess)}
        </p>
        {hasBoard && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
            <input type="checkbox" checked={deleteBoard} onChange={e => setDeleteBoard(e.target.checked)} className="mt-0.5 accent-red-500" />
            <span className="text-xs text-gray-600">{t.dashDeleteAlsoBoard}</span>
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={() => onConfirm(deleteBoard)} className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors">{t.dashDeleteConfirm}</button>
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">{t.dashDeleteCancel}</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ flows, loading, vimplUser, onOpen, onCreate, onDelete, onUpdateRag, onClassify, canCreate, onLogout, onDemo, onBurger, onOpenRounds }) {
  const { t } = useLang();
  const [deletingFlow, setDeletingFlow] = useState(null);

  const isTrial = !vimplUser || (vimplUser.subscriptionTier !== 'commercial' && vimplUser.subscriptionTier !== 'enterprise');
  const realFlows     = flows.filter(f => !f._demo);
  const realFlowCount = realFlows.length;
  const demoFlow      = flows.find(f => f._demo) || null;

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden">
      {/* Header — as on ailean.dk */}
      <header className="flex items-center gap-6 h-14 px-4 sm:px-8 bg-paper border-b border-line shrink-0">
        <span className="ailean-logo">AILEAN</span>
        <div className="ml-auto flex items-center gap-3">
          <TrustBadge />
          <LangSwitcher />
          {vimplUser && (
            isTrial ? (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-amber-50 text-ink border border-amber-200 px-2.5 py-0.5 rounded-full font-medium hover:bg-amber-100 transition-colors">
                {t.dashTrialBadge}
              </a>
            ) : (
              <span className="text-xs bg-case text-ink px-2 py-0.5 rounded-full font-medium capitalize border border-ink/20">
                {vimplUser.subscriptionTier}
              </span>
            )
          )}
          <button onClick={onBurger} className="w-9 h-9 grid place-items-center rounded-full border border-line bg-panel hover:border-ink transition-colors text-ink" aria-label={t.stepMenu}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="4" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="12.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Trial banner */}
      {isTrial && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-ink text-sm">⚡</span>
            <p className="text-xs text-ink">
              <span className="font-semibold">{t.dashTrialTitle}</span>{t.dashTrialBody}
            </p>
          </div>
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs bg-ink text-paper font-semibold px-3 py-1.5 rounded-lg hover:bg-ink-hover transition-colors">
            {t.dashSeePlans}
          </a>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
       <div className="max-w-[1360px] mx-auto">
        {/* Title bar */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.03em] leading-[1.05] text-ink">{t.dashTitle}</h1>
            <p className="text-sm text-mid mt-2">{t.dashSubtitle}</p>
            {isTrial && <p className="text-xs text-mid mt-1">{t.dashTrialIncluded}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenRounds && (
              <button onClick={onOpenRounds} className="text-sm font-medium text-ink border border-ink rounded-full px-4 py-2 hover:bg-ink hover:text-paper transition-colors">
                {t.dashRounds}
              </button>
            )}
            {canCreate ? (
              <button onClick={onCreate} className="flex items-center gap-1.5 bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-full hover:bg-ink-hover transition-colors">
                {t.dashNewFlow}
              </button>
            ) : (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-lg hover:bg-ink-hover transition-colors">
                {t.dashUpgradeAdd}
              </a>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Empty state */}
        {!loading && realFlowCount === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-3xl">🎙️</div>
            <p className="text-sm font-medium text-gray-700">{t.dashEmptyTitle}</p>
            <p className="text-xs text-gray-400">{t.dashEmptyBody}</p>
            <button onClick={onCreate} className="mt-2 bg-ink text-paper text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-ink-hover transition-colors">
              {t.dashEmptyBtn}
            </button>
          </div>
        )}

        {/* Process overview: portfolio → areas → processes */}
        {!loading && realFlowCount > 0 && (
          <ProcessOverview flows={flows} onOpen={onOpen} onUpdateRag={onUpdateRag} onDelete={setDeletingFlow} onClassify={onClassify} />
        )}

        {/* Upgrade card */}
        {!canCreate && isTrial && (
          <div className="mt-6 bg-white border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-800">{t.dashUpgradeTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.dashUpgradeBody}</p>
            </div>
            <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-sm bg-ink text-paper font-semibold px-4 py-2 rounded-lg hover:bg-ink-hover transition-colors">
              {t.dashUpgradeBtn}
            </a>
          </div>
        )}

        {/* Try Demo card — only shown before user has any real flows */}
        {(realFlowCount === 0 || demoFlow) && <div className="mt-6 bg-panel border border-line rounded-[10px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{t.dashDemoTitle}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.dashDemoDesc}</p>
          </div>
          <button onClick={() => (demoFlow ? onOpen(demoFlow.id) : onDemo())} className="shrink-0 text-sm border border-ink text-ink font-medium px-4 py-2 rounded-full hover:bg-ink hover:text-paper transition-colors whitespace-nowrap">
            {demoFlow ? t.dashDemoContinue : t.dashDemoBtn}
          </button>
        </div>}
       </div>
      </div>

      {deletingFlow && (
        <DeleteModal
          flow={deletingFlow}
          onConfirm={(deleteBoard) => { onDelete(deletingFlow.id, deleteBoard); setDeletingFlow(null); }}
          onCancel={() => setDeletingFlow(null)}
        />
      )}
    </div>
  );
}
