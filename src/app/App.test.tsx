import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('открывает экран «Сегодня» и показывает навигацию', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Начать' })).toBeInTheDocument()
  })
})
