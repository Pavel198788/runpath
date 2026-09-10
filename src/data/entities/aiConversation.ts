import type { BaseEntity } from './base'
import type { AiMessage } from '@/ai/providers/types'

export interface AiConversation extends BaseEntity {
  title: string
  messages: Array<AiMessage & { at: string }>
}
