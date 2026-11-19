import { createContext, useContext, useState } from 'react';
import { savePreferences } from '../services/preferencesService.js';
import { translations } from './translations.js';


const LangContext = createContext({ lang: 'en', t: translations.en, setLang: () => {} });

export function LangProvider({ children }) {
  const browserDefault = navigator.language?.startsWith('da') ? 'da' : 'en';
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('voice2bpmn_lang') || browserDefault
  );

  // The account's saved language arrives after login (App → preferences); apply it without saving again
  function syncLang(l) {
    if (l !== 'en' && l !== 'da') return;
    setLangState(l);
    try { localStorage.setItem('voice2bpmn_lang', l); } catch { /* ignore */ }
  }

  function setLang(l) {
    syncLang(l);
    savePreferences({ preferredLang: l });
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], setLang, syncLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
