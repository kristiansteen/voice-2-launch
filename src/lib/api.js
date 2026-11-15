// import.meta.env is undefined under node --test
export const BACKEND_URL = import.meta.env?.DEV
  ? 'http://localhost:3001'
  : 'https://backend-eight-rho-46.vercel.app';

export function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}
