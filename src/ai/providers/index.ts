import type { Settings } from '@/data/entities'
import { features } from '@/config/features'
import { AnthropicByokProvider } from './anthropic'
import { OpenAiByokProvider } from './openai'
import type { AiProvider } from './types'

export type { AiMessage, AiProvider, AiRequest, AiRole } from './types'

/** Точка подключения: BYOK сейчас, прокси на сервере — этап B2 (features.server). */
export function createAiProvider(settings: Settings): AiProvider | null {
  void features
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
  return null
}
