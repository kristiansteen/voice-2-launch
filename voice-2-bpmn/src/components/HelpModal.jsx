import { useLang } from '../i18n/LangContext.jsx';

export default function HelpModal({ onClose }) {
  const { t } = useLang();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <h2 className="text-base font-semibold text-gray-800">{t.helpTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg px-1 leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-gray-700">

          {/* What is this */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {t.helpWhatTitle}
            </h3>
            <p className="leading-relaxed text-gray-600">{t.helpWhatBody}</p>
          </section>

          {/* How to get an API key */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {t.helpApiKeyTitle}
            </h3>
            <ol className="space-y-3">
              {[t.helpStep1, t.helpStep2, t.helpStep3, t.helpStep4].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              console.anthropic.com/settings/keys ↗
            </a>
          </section>

          {/* How to set it in the app */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {t.helpSetKeyTitle}
            </h3>
            <ol className="space-y-3">
              {[t.helpSetStep1, t.helpSetStep2, t.helpSetStep3].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-vimpl text-black text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Privacy note */}
          <section className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">
              🔒 {t.helpPrivacyNote}
            </p>
          </section>

          {/* Workflow overview */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              {t.helpWorkflowTitle}
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { num: '1', label: t.panel1, desc: t.helpFlow1 },
                { num: '2', label: t.panel2, desc: t.helpFlow2 },
                { num: '3', label: t.panel3, desc: t.helpFlow3 },
                { num: '4', label: t.panel4, desc: t.helpFlow4 },
                { num: '5', label: t.panel5, desc: t.helpFlow5 },
              ].map(({ num, label, desc }) => (
                <div key={num} className="flex gap-3 items-start">
                  <span className="shrink-0 text-xs font-mono text-gray-400 mt-0.5 w-4">{num}</span>
                  <span className="shrink-0 text-xs font-medium text-gray-700 w-16">{label}</span>
                  <span className="text-xs text-gray-500 leading-relaxed">{desc}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t.helpGotIt}
          </button>
        </div>
      </div>
    </div>
  );
}
