import type { Settings } from '@/data/entities'
import { features } from '@/config/features'
import { AnthropicByokProvider } from './anthropic'
import { OpenAiByokProvider } from './openai'
import { ProxyAiProvider } from './proxy'
import type { AiProvider } from './types'

export type { AiMessage, AiProvider, AiRequest, AiRole } from './types'
export { ProxyAiProvider } from './proxy'

/**
 * Выбор провайдера: свой ключ пользователя главнее (он платит сам и без квот),
 * иначе — прокси на сервере, если есть аккаунт.
 */
export function createAiProvider(settings: Settings, signedIn = false): AiProvider | null {
  if (settings.aiProvider === 'anthropic' && settings.aiApiKey) {
    return new AnthropicByokProvider(settings.aiApiKey, settings.aiModel || 'claude-sonnet-5')
  }
  if (settings.aiProvider === 'openai' && settings.aiApiKey) {
    return new OpenAiByokProvider(
      settings.aiApiKey,
      settings.aiBaseUrl || 'https://api.openai.com/v1',
      settings.aiModel || 'gpt-4o-mini',
    )
  }
  if (features.server && signedIn) return new ProxyAiProvider()
  return null
}
