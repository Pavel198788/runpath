import type { AiProvider, AiRequest } from './types'
import { describeError, readSse } from './anthropic'

/** OpenAI-совместимый API (OpenAI, OpenRouter, локальные серверы) с ключом пользователя. */
export class OpenAiByokProvider implements AiProvider {
  readonly id = 'byok-openai' as const
  constructor(
    private apiKey: string,
    private baseUrl = 'https://api.openai.com/v1',
    private model = 'gpt-4o-mini',
  ) {}

  async isAvailable() {
    return this.apiKey.length > 5
  }

  async *stream(request: AiRequest, signal?: AbortSignal): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: signal ?? null,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        max_tokens: request.maxTokens ?? 1024,
        messages: [{ role: 'system', content: request.system }, ...request.messages],
      }),
    })
    if (!res.ok || !res.body) throw new Error(await describeError(res))
    yield* readSse(
      res.body,
      (json) => (json.choices?.[0]?.delta?.content as string | undefined) ?? null,
    )
  }
}
