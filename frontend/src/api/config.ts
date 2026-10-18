/** Keep API routing in one place. Production can use a same-origin /api proxy. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const endpoints = {
  health: '/health',
  alerts: '/api/v1/alerts',
  alert: (id: string) => `/api/v1/alerts/${encodeURIComponent(id)}`,
  investigate: (id: string) => `/api/v1/investigations/${encodeURIComponent(id)}`,
  decision: (id: string) => `/api/v1/investigations/${encodeURIComponent(id)}/decision`,
};
