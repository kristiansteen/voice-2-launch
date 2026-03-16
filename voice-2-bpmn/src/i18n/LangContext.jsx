import { createContext, useContext, useState } from 'react';
import { translations } from './translations.js';

const LangContext = createContext({ lang: 'en', t: translations.en, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('voice2bpmn_lang') || 'en'
  );

  function setLang(l) {
    setLangState(l);
    localStorage.setItem('voice2bpmn_lang', l);
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
