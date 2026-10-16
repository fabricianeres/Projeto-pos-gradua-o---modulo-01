import type {
  ApiErrorBody,
  ApiErrorDetail,
  ApiProblem,
  ApiResult,
  SessionRequest,
  SessionResponse,
} from './types'

const defaultBaseUrl = 'http://127.0.0.1:3000/api/v1'
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1'
}

function getBaseUrl(): string {
  let parsed: URL

  try {
    parsed = new URL(configuredBaseUrl)
  } catch {
    throw new Error('A URL da API local é inválida. Confira VITE_API_BASE_URL.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isLoopback(parsed.hostname)) {
    throw new Error('A página de testes aceita somente uma API em localhost/127.0.0.1.')
  }

  return parsed.toString().replace(/\/$/, '')
}

function buildError(status: number, body: unknown): ApiProblem {
  const payload = body && typeof body === 'object' ? (body as ApiErrorBody) : undefined
  const problem = new Error(payload?.mensagem || `A API respondeu com HTTP ${status}.`) as ApiProblem
  problem.status = status
  problem.code = payload?.codigo
  problem.details = Array.isArray(payload?.detalhes)
    ? payload.detalhes.filter(
        (detail): detail is ApiErrorDetail =>
          typeof detail === 'object' &&
          detail !== null &&
          typeof detail.mensagem === 'string',
      )
    : undefined
  return problem
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const baseUrl = getBaseUrl()
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch {
    throw new Error('Não foi possível conectar à API local. Verifique se ela está ativa em localhost.')
  }

  let body: unknown = null
  if (response.status !== 204) {
    const text = await response.text()
    if (text) {
      try {
        body = JSON.parse(text) as unknown
      } catch {
        body = text
      }
    }
  }

  if (!response.ok) {
    throw buildError(response.status, body)
  }

  return {
    status: response.status,
    body: body as T | null,
  }
}

export const api = {
  login(credentials: SessionRequest): Promise<ApiResult<SessionResponse>> {
    return request<SessionResponse>('/auth/sessao', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  logout(token: string): Promise<ApiResult<unknown>> {
    return request('/auth/sessao', { method: 'DELETE' }, token)
  },

  execute<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    token: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    return request<T>(
      path,
      {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      token,
    )
  },
}
