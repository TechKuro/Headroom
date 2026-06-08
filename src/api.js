// Thin client for the serverless document API. Attaches the Entra bearer token
// when signed in, or a display-name header in shared no-login mode.
import { getAccessToken, getDisplayName } from './auth/authConfig';

const BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const name = getDisplayName();
    if (name) headers['X-Display-Name'] = name;
  }

  const res = await fetch(BASE + path, { ...options, headers });
  if (res.status === 204) return null;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  listDocs: () => apiFetch('/docs'),
  getDoc: (id) => apiFetch(`/docs/${encodeURIComponent(id)}`),
  createDoc: (name, data) => apiFetch('/docs', { method: 'POST', body: JSON.stringify({ name, data }) }),
  saveDoc: (id, data, name, lastKnownUpdatedAt) =>
    apiFetch(`/docs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ data, name, lastKnownUpdatedAt }) }),
  renameDoc: (id, name) => apiFetch(`/docs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteDoc: (id) => apiFetch(`/docs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
