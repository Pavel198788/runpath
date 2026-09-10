import { db } from '@/data/db'
import { Api, ApiError } from '@/sync/api'
import type { AiProvider, AiRequest } from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/**
 * ИИ через сервер приложения: ключ владельца остаётся на сервере, здесь только запросы.
 * Стриминг через SSE, если сервер его поддерживает; иначе обычный ответ одним куском.
 */
export class ProxyAiProvider implements AiProvider {
  readonly id = 'proxy' as const

  async isAvailable(): Promise<boolean> {
    if (!API_URL) return false
    const meta = await db.syncMeta.get('meta')
    return Boolean(meta?.accessToken)
  }

  async *stream(request: AiRequest, signal?: AbortSignal): AsyncIterable<string> {
    const meta = await db.syncMeta.get('meta')
    const token = meta?.accessToken
    if (!token) throw new Error('Нужен вход в аккаунт')

    const response = await fetch(`${API_URL}/v1/ai/chat`, {
      method: 'POST',
      signal: signal ?? null,
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: request.system,
        messages: request.messages,
        maxTokens: request.maxTokens ?? 1024,
      }),
    })

    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
      throw new ApiError(
        json.error ?? 'ai_error',
        json.message ?? 'Ошибка сервиса ИИ',
        response.status,
      )
    }

    // Сервер мог ответить обычным JSON, если стриминг на хостинге недоступен.
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      const json = (await response.json()) as { text?: string }
      if (json.text) yield json.text
      return
    }
    if (!response.body) return

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            const json = JSON.parse(line.slice(5).trim()) as { text?: string; done?: boolean }
            if (json.text) yield json.text
          } catch {
            /* пропускаем битые строки */
          }
        }
      }
    }
  }

  /** Остаток дневной квоты — показываем в чате. */
  async quota(): Promise<{ remaining: number; dailyLimit: number } | null> {
    const meta = await db.syncMeta.get('meta')
    if (!meta?.accessToken || !API_URL) return null
    try {
      return await new Api(API_URL).aiQuota(meta.accessToken)
    } catch {
      return null
    }
  }
}
