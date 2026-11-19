// User preferences on the account (B40): language and process taxonomy.
// The app keeps reading them from localStorage as before; this file copies the
// account's saved values into localStorage after login, and saves changes back.

const BACKEND_URL = import.meta.env?.DEV ? 'http://localhost:3001' : 'https://backend-eight-rho-46.vercel.app';
const URL_PREFS = `${BACKEND_URL}/api/v1/auth/me/preferences`;

export const KEYS = {
  lang: 'voice2bpmn_lang',
  source: 'voice2bpmn_taxonomy_source',
  custom: 'voice2bpmn_custom_taxonomy',
  customName: 'voice2bpmn_custom_taxonomy_name',
};

let token = null;
export function setPreferencesToken(t) { token = t || null; }

/** Write saved preferences into the browser keys. Returns the saved language, if any. */
export function applyPreferencesToStorage(prefs = {}, storage = globalThis.localStorage) {
  if (!storage || !prefs || typeof prefs !== 'object') return null;
  try {
    if (prefs.preferredLang) storage.setItem(KEYS.lang, prefs.preferredLang);
    if (prefs.taxonomySource) storage.setItem(KEYS.source, prefs.taxonomySource);
    if (prefs.customTaxonomyName) storage.setItem(KEYS.customName, prefs.customTaxonomyName);
    if (Array.isArray(prefs.customTaxonomy)) storage.setItem(KEYS.custom, JSON.stringify(prefs.customTaxonomy));
  } catch { /* storage full or blocked: the browser copy stays as it was */ }
  return prefs.preferredLang || null;
}

/** The taxonomy choice as stored in this browser, in the shape the backend saves. */
export function taxonomyPreferencesFromStorage(storage = globalThis.localStorage) {
  const get = k => { try { return storage.getItem(k); } catch { return null; } };
  let custom = null;
  try { custom = JSON.parse(get(KEYS.custom) || 'null'); } catch { custom = null; }
  return {
    taxonomySource: get(KEYS.source) || 'apqc',
    customTaxonomyName: get(KEYS.customName) || null,
    customTaxonomy: Array.isArray(custom) ? custom : null,
  };
}

export async function loadPreferences() {
  if (!token) return null;
  try {
    const r = await fetch(URL_PREFS, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null; // 503 until the table exists: keep the browser's copy
    const { preferences } = await r.json();
    return preferences || null;
  } catch { return null; }
}

/** Fire-and-forget save of a partial set of preferences. */
export function savePreferences(patch) {
  if (!token || !patch) return;
  fetch(URL_PREFS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  }).catch(() => {});
}
