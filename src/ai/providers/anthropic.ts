import type { AiProvider, AiRequest } from './types'

/**
 * Прямой вызов Anthropic API из браузера с ключом пользователя (BYOK).
 * Заголовок anthropic-dangerous-direct-browser-access включает CORS — риск объяснён в UI:
 * ключ виден в браузере, поэтому это только для личного ключа на своём устройстве.
 */
export class AnthropicByokProvider implements AiProvider {
  readonly id = 'byok-anthropic' as const
  constructor(
    private apiKey: string,
    private model = 'claude-sonnet-5',
  ) {}

  async isAvailable() {
    return this.apiKey.length > 10
  }

  async *stream(request: AiRequest, signal?: AbortSignal): AsyncIterable<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: signal ?? null,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        // Системный промт кэшируем: он большой и не меняется между сообщениями.
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    })
    if (!res.ok || !res.body) throw new Error(await describeError(res))
    yield* readSse(res.body, (json) => {
      if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta')
        return json.delta.text as string
      return null
    })
  }
}

/** Общий читатель SSE-потока: вызывает pick для каждого JSON-события. */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
  pick: (json: SseJson) => string | null,
): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const ev of events) {
      for (const line of ev.split('\n')) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        try {
          const text = pick(JSON.parse(data) as SseJson)
          if (text) yield text
        } catch {
          /* пропускаем битые строки */
        }
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SseJson = any

export async function describeError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    return j.error?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}
