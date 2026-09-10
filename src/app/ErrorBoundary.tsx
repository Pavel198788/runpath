import { Component, type ErrorInfo, type ReactNode } from 'react'
import { refreshApp } from './lazyWithRetry'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Ловит ошибки экранов, чтобы приложение не превращалось в пустую страницу.
 * Тексты по-русски и без технических подробностей: человеку нужна кнопка, а не стек вызовов.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // В консоль — для диагностики; наружу ничего не отправляем.
    console.error('Ошибка экрана', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Экран не открылся</h1>
        <p className="text-muted">
          Скорее всего, на устройстве осталась старая версия приложения. Обновим её — данные о
          тренировках сохранятся, они лежат отдельно.
        </p>
        <button
          type="button"
          onClick={() => void refreshApp()}
          className="bg-accent text-accent-fg min-h-14 w-full rounded-xl px-6 text-lg font-semibold"
        >
          Обновить приложение
        </button>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="text-muted min-h-11 text-sm"
        >
          Попробовать ещё раз
        </button>
      </div>
    )
  }
}
