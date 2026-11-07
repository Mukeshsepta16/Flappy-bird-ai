/** Thin wrapper around the Flask API. All network access in the app goes through here. */
export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const BASE = (window.__API_BASE__ || '') + '/api';

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method, signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the backend. Is the server running?', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  health: () => request('/health'),
  config: () => request('/config'),
  models: () => request('/models'),
  model: (id) => request(`/models/${id}`),
  predict: (model, features, signal) => request('/predict', { method: 'POST', body: { model, features }, signal }),
  train: (algo, episodes, seed) => request('/train', { method: 'POST', body: { algo, episodes, seed } }),
  scores: (mode, limit = 10) => request(`/scores?limit=${limit}${mode ? `&mode=${mode}` : ''}`),
  submitScore: (name, mode, score) => request('/scores', { method: 'POST', body: { name, mode, score } }),
};
