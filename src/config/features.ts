/**
 * Флаги фич. Всё серверное выключено до этапа B — приложение обязано
 * работать полностью автономно. Флаги читаются из окружения сборки,
 * чтобы включать модули без правки кода.
 */
export const features = {
  /** Есть ли сервер вообще (аккаунты, синхронизация, прокси ИИ, push). Этап B. */
  server: import.meta.env.VITE_FEATURE_SERVER === 'true',
  /** ИИ-тренер со своим ключом пользователя (BYOK). Этап A5. */
  aiByok: true,
  /** GPS-трекинг. Этап A2. */
  gps: false,
  /** Питание. Этап A3. */
  nutrition: false,
} as const

export type FeatureFlag = keyof typeof features
