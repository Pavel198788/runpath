import { render, screen, fireEvent } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { db } from '@/data/db'

beforeAll(async () => {
  await Promise.all([import('./OnboardingPage'), import('@/features/today/TodayPage')])
})

beforeEach(async () => {
  await Promise.all([db.profiles.clear(), db.plans.clear(), db.workouts.clear()])
})

const next = async () => fireEvent.click(await screen.findByRole('button', { name: 'Продолжить' }))

describe('Онбординг', () => {
  it('проходит все шаги, строит план и открывает «Сегодня»', async () => {
    render(<App />)
    // С экрана «Сегодня» — в онбординг (роутер создаётся один раз, поэтому идём как пользователь).
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }, { timeout: 5000 }))
    // 1. Дисклеймер
    fireEvent.click(await screen.findByRole('checkbox', {}, { timeout: 5000 }))
    await next()
    // 2. О себе — пропускаем
    await screen.findByText('О тебе')
    await next()
    // 3. Уровень
    fireEvent.click(await screen.findByRole('radio', { name: /30 минут/ }))
    await next()
    // 4. Здоровье — ничего
    await screen.findByText('Особенности здоровья')
    await next()
    // 5. Цель
    fireEvent.click(await screen.findByRole('radio', { name: /Марафон/ }))
    await next()
    // 6. Дни — по умолчанию пн/ср/сб
    await screen.findByText('Когда тренируешься')
    await next()
    // 7. Итог
    expect(await screen.findByText('Твой план готов')).toBeInTheDocument()
    expect(screen.getAllByText(/недел/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Открыть/ }))

    expect(
      await screen.findByRole('heading', { name: 'Сегодня' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const plan = await db.plans.filter((p) => p.isActive).first()
    expect(plan).toBeDefined()
    expect(await db.workouts.where('planId').equals(plan!.id).count()).toBeGreaterThan(100)
    const profile = await db.profiles.toArray()
    expect(profile[0]?.onboardingCompletedAt).toBeTruthy()
  }, 30_000)
})
