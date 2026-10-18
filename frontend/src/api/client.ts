import { API_BASE_URL, endpoints } from './config';
import type { AlertDetail, AlertSummary, AnalystDecision, AnalystDecisionRequest, HealthResponse, InvestigationResponse } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'Cannot connect to the FinGuard API. Confirm that FastAPI is running and the API URL is configured.');
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? String(body.detail) : response.statusText;
    throw new ApiError(response.status, `API ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>(endpoints.health),
  alerts: () => request<AlertSummary[]>(endpoints.alerts),
  alert: (id: string) => request<AlertDetail>(endpoints.alert(id)),
  investigate: (id: string) => request<InvestigationResponse>(endpoints.investigate(id), { method: 'POST' }),
  decide: (id: string, decision: AnalystDecisionRequest) => request<AnalystDecision>(endpoints.decision(id), { method: 'POST', body: JSON.stringify(decision) }),
};
