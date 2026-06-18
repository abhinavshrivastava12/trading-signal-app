import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Signals ───────────────────────────────────────────────────────────────────
export const createSignal = (data) => api.post('/api/signals', data);
export const listSignals = () => api.get('/api/signals');
export const getSignal = (id) => api.get(`/api/signals/${id}`);
export const deleteSignal = (id) => api.delete(`/api/signals/${id}`);
export const getSignalStatus = (id) => api.get(`/api/signals/${id}/status`);

export default api;
