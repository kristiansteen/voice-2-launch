import { useLang } from '../i18n/LangContext.jsx';

export default function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-switcher">
      <button
        className={`lang-btn${lang === 'en' ? ' active' : ''}`}
        onClick={() => setLang('en')}
      >EN</button>
      <button
        className={`lang-btn${lang === 'da' ? ' active' : ''}`}
        onClick={() => setLang('da')}
      >DA</button>
    </div>
  );
}
