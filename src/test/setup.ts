import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import '@/i18n'

// matchMedia отсутствует в jsdom — нужен для темы.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
