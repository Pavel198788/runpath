import type { SyncedCollection } from './types'

/** Клиент REST API. Все ошибки превращаются в понятные человеку сообщения. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  emailVerified?: boolean
}

export interface RemoteDocument {
  collection: SyncedCollection
  id: string
  data: Record<string, unknown>
  updatedAt: string
  deletedAt: string | null
  syncVersion: number
}

export interface PushResult {
  accepted: Array<{ id: string; collection: string; syncVersion: number }>
  conflicts: Array<{ id: string | null; collection?: string; reason: string }>
  version: number
}

export class Api {
  constructor(private baseUrl: string) {}

  async request<T>(
    path: string,
    options: { method?: string; body?: unknown; token?: string | null } = {},
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      })
    } catch {
      // fetch падает только при отсутствии сети — это не ошибка приложения.
      throw new ApiError('offline', 'Нет связи с сервером', 0)
    }
    const text = await response.text()
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    if (!response.ok) {
      throw new ApiError(
        String(json.error ?? 'error'),
        String(json.message ?? 'Ошибка сервера'),
        response.status,
      )
    }
    return json as T
  }

  register(email: string, password: string) {
    return this.request<AuthTokens>('/v1/auth/register', {
      method: 'POST',
      body: { email, password },
    })
  }

  login(email: string, password: string) {
    return this.request<AuthTokens>('/v1/auth/login', { method: 'POST', body: { email, password } })
  }

  refresh(refreshToken: string) {
    return this.request<AuthTokens>('/v1/auth/refresh', { method: 'POST', body: { refreshToken } })
  }

  logout(refreshToken: string) {
    return this.request<{ ok: boolean }>('/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    })
  }

  forgot(email: string) {
    return this.request<{ ok: boolean }>('/v1/auth/forgot', { method: 'POST', body: { email } })
  }

  me(token: string) {
    return this.request<{ id: string; email: string; role: string }>('/v1/me', { token })
  }

  deleteAccount(token: string) {
    return this.request<{ ok: boolean }>('/v1/me', { method: 'DELETE', token })
  }

  changes(token: string, since: number) {
    return this.request<{
      documents: RemoteDocument[]
      version: number
      serverVersion: number
      hasMore: boolean
    }>(`/v1/sync/changes?since=${since}`, { token })
  }

  push(token: string, documents: unknown[]) {
    return this.request<PushResult>('/v1/sync/push', { method: 'POST', body: { documents }, token })
  }

  pushKey(token: string) {
    return this.request<{ publicKey: string }>('/v1/push/key', { token })
  }

  subscribePush(token: string, body: unknown) {
    return this.request<{ ok: boolean }>('/v1/push/subscribe', { method: 'POST', body, token })
  }

  unsubscribePush(token: string, endpoint: string) {
    return this.request<{ ok: boolean }>('/v1/push/unsubscribe', {
      method: 'POST',
      body: { endpoint },
      token,
    })
  }

  integrations(token: string) {
    return this.request<{
      integrations: Array<{ provider: string; last_sync_at: string | null }>
      available: Record<string, boolean>
    }>('/v1/integrations', { token })
  }

  stravaAuthorize(token: string) {
    return this.request<{ url: string }>('/v1/integrations/strava/authorize', { token })
  }

  disconnectIntegration(token: string, provider: string) {
    return this.request<{ ok: boolean }>(`/v1/integrations/${provider}`, {
      method: 'DELETE',
      token,
    })
  }

  syncIntegration(token: string, provider: string) {
    return this.request<{ queued: boolean }>(`/v1/integrations/${provider}/sync`, {
      method: 'POST',
      token,
    })
  }

  aiChat(token: string, system: string, messages: Array<{ role: string; content: string }>) {
    return this.request<{ text: string; quota: Record<string, number> }>('/v1/ai/chat', {
      method: 'POST',
      body: { system, messages },
      token,
    })
  }

  aiQuota(token: string) {
    return this.request<{ usedToday: number; dailyLimit: number; remaining: number }>(
      '/v1/ai/quota',
      { token },
    )
  }
}
