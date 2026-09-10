import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { App } from './App'

// Ленивые чанки в vitest грузятся секунды — прогреваем модуль до рендера,
// чтобы тест проверял поведение, а не скорость сборки.
beforeAll(async () => {
  await import('@/features/today/TodayPage')
})

describe('App', () => {
  it('без профиля открывает «Сегодня» с приглашением в онбординг', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'Сегодня' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Начать' })).toBeInTheDocument()
  }, 15_000)
})
