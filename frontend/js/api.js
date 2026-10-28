const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('cms_token');
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('cms_user') || 'null'); } catch { return null; }
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/pages/login.html';
    throw new Error(data.message || 'Session expired');
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
