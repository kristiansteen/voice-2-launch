// import.meta.env is undefined under node --test
const PROD_BACKEND = 'https://backend-eight-rho-46.vercel.app';

// One place for the backend address. A preview can be pointed at the test
// backend (B51) by setting VITE_BACKEND_URL for that branch in Vercel.
export function resolveBackendUrl(env) {
  if (env?.DEV) return 'http://localhost:3001';
  const custom = (env?.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^/]+$/.test(custom) ? custom : PROD_BACKEND;
}

// import.meta.env is undefined under node --test
export const BACKEND_URL = resolveBackendUrl(import.meta.env);

export function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}
