import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'

interface UiState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

/**
 * Лёгкое UI-состояние (тема и т.п.). Пользовательские данные — только в Dexie,
 * здесь лишь то, что не нужно синхронизировать и бэкапить.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'runpath-ui' },
  ),
)

/** Применяет тему к <html>: класс .dark включает тёмные токены из index.css. */
export function applyTheme(theme: ThemeMode) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}
