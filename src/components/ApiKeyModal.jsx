import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

export default function ApiKeyModal({ apiKey, onSave, onClose }) {
  const { t } = useLang();
  const [value, setValue] = useState(apiKey);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">{t.apiKeyTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.apiKeyInfo}</p>
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => onSave(value.trim())}
            className="text-sm px-4 py-2 bg-vimpl text-black rounded-md hover:bg-vimpl-dark hover:text-white transition-colors"
          >
            {t.saveBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
