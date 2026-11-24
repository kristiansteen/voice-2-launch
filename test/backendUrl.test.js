import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBackendUrl } from '../src/lib/api.js';

const PROD = 'https://backend-eight-rho-46.vercel.app';

test('production backend by default', () => {
  assert.equal(resolveBackendUrl({}), PROD);
  assert.equal(resolveBackendUrl(undefined), PROD);
});

test('local backend in dev', () => {
  assert.equal(resolveBackendUrl({ DEV: true }), 'http://localhost:3001');
});

test('VITE_BACKEND_URL points a preview at the test backend', () => {
  assert.equal(resolveBackendUrl({ VITE_BACKEND_URL: 'https://api-preview.ailean.dk/' }), 'https://api-preview.ailean.dk');
});

test('a VITE_BACKEND_URL that is not https is ignored', () => {
  assert.equal(resolveBackendUrl({ VITE_BACKEND_URL: 'http://evil.example' }), PROD);
  assert.equal(resolveBackendUrl({ VITE_BACKEND_URL: '' }), PROD);
});
