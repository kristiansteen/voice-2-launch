import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations.js';

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:3001' : 'https://backend-eight-rho-46.vercel.app';
const PREFS_URL = `${BACKEND_URL}/api/v1/auth/me/preferences`;

const LangContext = createContext({ lang: 'en', t: translations.en, setLang: () => {} });

export function LangProvider({ children }) {
  const browserDefault = navigator.language?.startsWith('da') ? 'da' : 'en';
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('voice2bpmn_lang') || browserDefault
  );

  // Sync language preference from server on mount
  useEffect(() => {
    fetch(PREFS_URL, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(prefs => {
        if (prefs?.preferredLang && prefs.preferredLang !== lang) {
          setLangState(prefs.preferredLang);
          localStorage.setItem('voice2bpmn_lang', prefs.preferredLang);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setLang(l) {
    setLangState(l);
    localStorage.setItem('voice2bpmn_lang', l);
    // Persist to server (fire-and-forget)
    fetch(PREFS_URL, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLang: l }),
    }).catch(() => {});
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
