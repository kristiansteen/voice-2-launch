import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

export default function ApiKeyModal({
  apiKey, onSave, onClose,
  user, sessionStatus, onGoogleSignIn, onSignOut,
}) {
  const { t } = useLang();
  const [tab, setTab] = useState(apiKey ? 'byok' : 'free');
  const [value, setValue] = useState(apiKey || '');

  const freeLabel = {
    available: 'One free session available',
    active:    '✓ Free session active',
    used:      'Free session already used',
  }[sessionStatus] ?? 'One free session available';

  const freeSubLabel = {
    available: 'Sign in with Google to use it',
    active:    'You can complete your full workflow',
    used:      'Add your own Anthropic API key to continue',
  }[sessionStatus] ?? '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Set up API access</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose how you'd like to use Voice-to-Launch</p>
        </div>
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab('free')} className={['flex-1 py-3 text-xs font-medium transition-colors border-b-2', tab === 'free' ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'].join(' ')}>
            Try for free
          </button>
          <button onClick={() => setTab('byok')} className={['flex-1 py-3 text-xs font-medium transition-colors border-b-2', tab === 'byok' ? 'border-gray-500 text-gray-700' : 'border-transparent text-gray-400 hover:text-gray-600'].join(' ')}>
            Use your own key
          </button>
        </div>
        <div className="px-6 py-5">
          {tab === 'free' && (
            <div className="space-y-4">
              <div className={['rounded-lg p-4 border text-center', sessionStatus === 'used' ? 'border-orange-200 bg-orange-50' : sessionStatus === 'active' ? 'border-green-200 bg-green-50' : 'border-purple-100 bg-purple-50'].join(' ')}>
                <p className={['text-sm font-medium', sessionStatus === 'used' ? 'text-orange-700' : sessionStatus === 'active' ? 'text-green-700' : 'text-purple-700'].join(' ')}>{freeLabel}</p>
                <p className="text-xs text-gray-500 mt-1">{freeSubLabel}</p>
              </div>
              {!user ? (
                <button onClick={onGoogleSignIn} disabled={sessionStatus === 'used'} className="w-full flex items-center justify-center gap-2.5 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.09 0-3.86-1.41-4.49-3.3H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.49 10.51A4.8 4.8 0 0 1 4.24 9c0-.52.09-1.03.25-1.51V5.42H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.58l2.66-2.07z"/><path fill="#EA4335" d="M8.98 3.58c1.18 0 2.24.4 3.07 1.2l2.3-2.3A8 8 0 0 0 .98 9l2.51 1.95C4.12 4.99 6.2 3.58 8.98 3.58z"/></svg>
                  Sign in with Google
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                    {user.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{user.user_metadata?.full_name || user.email}</p>
                      <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button onClick={onSignOut} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors shrink-0">Sign out</button>
                  </div>
                  {sessionStatus !== 'used' && (
                    <button onClick={() => onSave(null, 'free')} className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-purple-700 transition-colors">
                      {sessionStatus === 'active' ? 'Continue free session' : 'Start free session'}
                    </button>
                  )}
                  {sessionStatus === 'used' && (
                    <p className="text-xs text-center text-gray-400">Switch to <button onClick={() => setTab('byok')} className="text-purple-600 underline">your own key</button> to keep using the app.</p>
                  )}
                </div>
              )}
              <p className="text-[10px] text-gray-400 text-center">One complete Voice-to-Launch workflow per account · No card required</p>
            </div>
          )}
          {tab === 'byok' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Your key is stored in memory only and never sent anywhere except the Anthropic API.</p>
              <input type="password" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && value.trim() && onSave(value.trim(), 'byok')} placeholder="sk-ant-..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" autoFocus />
              <button onClick={() => value.trim() && onSave(value.trim(), 'byok')} disabled={!value.trim()} className="w-full bg-gray-800 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-900 disabled:opacity-40 transition-colors">Save key</button>
            </div>
          )}
        </div>
        <div className="px-6 pb-4 flex justify-end">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}
