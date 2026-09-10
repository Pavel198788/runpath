// Заглушка виртуального модуля vite-plugin-pwa для тестов (service worker в jsdom нет).
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  }
}
