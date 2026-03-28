import { useState } from 'react';
import StepCompany from './components/StepCompany.jsx';
import StepClient from './components/StepClient.jsx';
import StepItems from './components/StepItems.jsx';
import StepPreview from './components/StepPreview.jsx';

const STEPS = ['Din virksomhed', 'Kunden', 'Ydelser', 'Generer tilbud'];

const defaultState = {
  company: { name: '', address: '', city: '', cvr: '', email: '', phone: '' },
  client: { name: '', attention: '', address: '', city: '', email: '' },
  items: [{ id: 1, description: '', qty: 1, unit: 'stk', unitPrice: '' }],
  meta: { offerNumber: '', validDays: 30, notes: '', currency: 'DKK' },
};

export default function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(defaultState);

  const update = (section, values) =>
    setData((prev) => ({ ...prev, [section]: { ...prev[section], ...values } }));

  const stepProps = { data, update, onNext: () => setStep((s) => s + 1), onBack: () => setStep((s) => s - 1) };

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-aison">Aison</h1>
        <p className="text-gray-500 text-sm mt-1">Tilbud på sekunder</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i < step ? 'step-done' : i === step ? 'step-active' : 'step-pending'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'text-aison font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {step === 0 && <StepCompany {...stepProps} />}
        {step === 1 && <StepClient {...stepProps} />}
        {step === 2 && <StepItems {...stepProps} />}
        {step === 3 && <StepPreview {...stepProps} />}
      </div>
    </div>
  );
}
