import type { AlertDetail, AlertSummary, AnalystDecision, Investigation } from './types'
import { API_ENDPOINTS, API_BASE_URL, apiUrl } from './config'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error(`Could not reach FinGuard API at ${API_BASE_URL}. Check that the backend is running and the API connection settings are correct.`)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: string }
      if (body.detail) message = body.detail
    } catch { /* The API may return a non-JSON error page. */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; ai_mode: string }>(API_ENDPOINTS.health),
  alerts: () => request<AlertSummary[]>(API_ENDPOINTS.alerts),
  alert: (id: string) => request<AlertDetail>(API_ENDPOINTS.alert(id)),
  investigate: (id: string) => request<Investigation>(API_ENDPOINTS.investigate(id), { method: 'POST' }),
  investigation: (id: string) => request<Investigation>(API_ENDPOINTS.investigation(id)),
  decide: (id: string, body: { action: string; rationale: string; analyst: string }) =>
    request<AnalystDecision>(API_ENDPOINTS.decision(id), { method: 'POST', body: JSON.stringify(body) }),
}
