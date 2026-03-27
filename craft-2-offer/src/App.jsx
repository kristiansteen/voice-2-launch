import { useState } from 'react';
import { useAisonStore } from './hooks/useAisonStore.js';
import LoginScreen from './components/LoginScreen.jsx';
import CompanySetup from './components/CompanySetup.jsx';
import SamtalePanel from './components/SamtalePanel.jsx';
import JobbeskrivelsePanel from './components/JobbeskrivelsePanel.jsx';
import TilbudPanel from './components/TilbudPanel.jsx';
import ProjektplanPanel from './components/ProjektplanPanel.jsx';

const STEPS = [
  { id: 0, label: 'Samtale', icon: '🎙' },
  { id: 1, label: 'Jobbeskrivelse', icon: '📋' },
  { id: 2, label: 'Tilbud', icon: '📄' },
  { id: 3, label: 'Projektplan', icon: '📅' },
];

function StepIndicator({ currentStep, setStep, offer }) {
  const stepDone = (idx) => {
    if (idx === 0) return !!offer.interviewText;
    if (idx === 1) return !!offer.jobbeskrivelse;
    if (idx === 2) return !!offer.tilbud;
    if (idx === 3) return !!offer.projektplan;
    return false;
  };

  return (
    <div className="flex items-center">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <button
            onClick={() => {
              // Only allow navigating to steps that can be reached
              if (idx === 0 || stepDone(idx - 1)) setStep(idx);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentStep === idx
                ? 'bg-[#1B4F72] text-white'
                : stepDone(idx)
                ? 'text-green-700 bg-green-50 hover:bg-green-100'
                : 'text-gray-400 bg-gray-100 cursor-default'
            }`}
          >
            <span>{stepDone(idx) && currentStep !== idx ? '✓' : step.icon}</span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
          {idx < STEPS.length - 1 && (
            <div className={`w-6 h-0.5 mx-1 ${stepDone(idx) ? 'bg-green-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const store = useAisonStore();
  const { auth, login, logout, offer, updateOffer, setStep, company, updateCompany, isCompanySet, token, newOffer } = store;
  const [showCompanySettings, setShowCompanySettings] = useState(false);

  // Not logged in
  if (!auth) {
    return <LoginScreen onLogin={login} />;
  }

  // Company not set up yet
  if (!isCompanySet || showCompanySettings) {
    return (
      <CompanySetup
        company={company}
        onSave={(data) => {
          updateCompany(data);
          setShowCompanySettings(false);
        }}
      />
    );
  }

  const currentStep = offer.currentStep ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1B4F72] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">Aison</span>
            <span className="text-xs text-gray-400 ml-2">{offer.tilbudsnummer}</span>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} setStep={setStep} offer={offer} />

        <div className="flex items-center gap-2">
          <button
            onClick={newOffer}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors hidden sm:block">
            Nyt tilbud
          </button>
          <div className="relative group">
            <button className="w-8 h-8 rounded-full bg-[#1B4F72] text-white text-xs font-bold flex items-center justify-center">
              {auth.name?.[0]?.toUpperCase() ?? auth.email?.[0]?.toUpperCase() ?? 'U'}
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <div className="px-3 py-2 border-b border-gray-50">
                <p className="text-xs font-medium text-gray-800 truncate">{auth.name ?? auth.email}</p>
                <p className="text-xs text-gray-400 truncate">{auth.email}</p>
              </div>
              <button
                onClick={() => setShowCompanySettings(true)}
                className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                Virksomhedsindstillinger
              </button>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50">
                Log ud
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main panel */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[500px] flex flex-col">
          {currentStep === 0 && (
            <SamtalePanel
              offer={offer}
              updateOffer={updateOffer}
              setStep={setStep}
              token={token}
            />
          )}
          {currentStep === 1 && (
            <JobbeskrivelsePanel
              offer={offer}
              updateOffer={updateOffer}
              setStep={setStep}
              token={token}
            />
          )}
          {currentStep === 2 && (
            <TilbudPanel
              offer={offer}
              updateOffer={updateOffer}
              setStep={setStep}
              token={token}
              company={company}
            />
          )}
          {currentStep === 3 && (
            <ProjektplanPanel
              offer={offer}
              updateOffer={updateOffer}
              setStep={setStep}
              token={token}
              company={company}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-gray-300">
        Aison · Drevet af vimpl & Claude AI
      </footer>
    </div>
  );
}
