/**
 * Единый интерфейс ИИ-провайдера. UI чата не знает, откуда приходит ответ:
 * - byok (этап A5): ключ пользователя, запрос прямо из браузера;
 * - proxy (этап B2): сервер с ключом владельца, квоты и учёт токенов.
 */
export type AiRole = 'user' | 'assistant'

export interface AiMessage {
  role: AiRole
  content: string
}

export interface AiRequest {
  system: string
  messages: AiMessage[]
  maxTokens?: number
}

export interface AiProvider {
  readonly id: 'byok-anthropic' | 'byok-openai' | 'proxy'
  isAvailable(): Promise<boolean>
  /** Стриминг ответа кусками; провайдер без стриминга отдаёт один кусок. */
  stream(request: AiRequest, signal?: AbortSignal): AsyncIterable<string>
}
