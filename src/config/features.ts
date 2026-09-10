/**
 * Флаги фич. Всё серверное выключено до этапа B — приложение обязано
 * работать полностью автономно. Флаги читаются из окружения сборки,
 * чтобы включать модули без правки кода.
 */
export const features = {
  /** Есть ли сервер (аккаунты, синхронизация, прокси ИИ, push). Включается адресом API при сборке. */
  server: import.meta.env.VITE_FEATURE_SERVER === 'true' && Boolean(import.meta.env.VITE_API_URL),
  /** ИИ-тренер со своим ключом пользователя (BYOK). Этап A5. */
  aiByok: true,
  gps: true,
  nutrition: true,
} as const

export type FeatureFlag = keyof typeof features
