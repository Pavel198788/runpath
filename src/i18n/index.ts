import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru/common.json'

/**
 * Инфраструктура переводов. Контент пока только русский, но все строки
 * интерфейса живут в JSON-файлах, а не в коде — так позже добавим языки.
 */
export const resources = {
  ru: { common: ru },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
