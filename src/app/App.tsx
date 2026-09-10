import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { applyTheme, useUiStore } from '@/store/uiStore'

export function App() {
  const theme = useUiStore((s) => s.theme)

  // Тема применяется к <html> и следует за системной, если выбрано «как в системе».
  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return <RouterProvider router={router} />
}
