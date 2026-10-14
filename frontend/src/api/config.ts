/**
 * FinGuard API connection settings.
 *
 * Edit this file to change the default API host or any endpoint path. A
 * VITE_API_BASE_URL environment value can override the default per build, so
 * local, staging, and production deployments can use the same frontend code.
 */
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const API_BASE_URL = (configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin))
  .replace(/\/+$/, '')

const id = (value: string) => encodeURIComponent(value)

export const API_ENDPOINTS = {
  health: '/health',
  alerts: '/api/v1/alerts',
  alert: (alertId: string) => `/api/v1/alerts/${id(alertId)}`,
  investigate: (alertId: string) => `/api/v1/investigations/${id(alertId)}`,
  investigation: (investigationId: string) => `/api/v1/investigations/${id(investigationId)}`,
  decision: (investigationId: string) => `/api/v1/investigations/${id(investigationId)}/decision`,
} as const

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
