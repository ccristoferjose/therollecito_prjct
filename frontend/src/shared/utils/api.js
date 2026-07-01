// In dev, Vite proxies /api to localhost:3001.
// In production, VITE_API_URL points to the Lightsail backend URL.
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Registered by StaffAuthProvider so the app can react globally to an expired
// or invalid staff session. Only fired for requests that carried a token —
// i.e. authenticated staff calls — so public/client requests never trip it.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(endpoint, options = {}) {
  const { body, token, raw, ...rest } = options;

  const headers = {};
  if (!raw) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: { ...headers, ...options.headers },
    body: body && !raw ? JSON.stringify(body) : body,
  });

  if (!res.ok) {
    // An authenticated request that 401s means the JWT expired or is invalid.
    // Notify the session handler so the user is logged out and redirected,
    // instead of silently staring at an empty dashboard.
    if (res.status === 401 && token && onUnauthorized) {
      onUnauthorized();
    }
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (url, token) => request(url, { token }),
  post: (url, body, token) => request(url, { method: 'POST', body, token }),
  put: (url, body, token) => request(url, { method: 'PUT', body, token }),
  patch: (url, body, token) => request(url, { method: 'PATCH', body, token }),
  delete: (url, token) => request(url, { method: 'DELETE', token }),
};
