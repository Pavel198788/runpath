import { expect, test } from '@playwright/test'

/**
 * Сквозная проверка живых экранов: онбординг с цифрами бегуна, затем все разделы,
 * которые раньше открывались пустой страницей.
 */
test('онбординг и все экраны открываются', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))

  await page.goto('/')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('checkbox').check()
  const next = page.getByRole('button', { name: 'Продолжить' })
  await next.click()
  // Пол: два варианта, «Другой» больше нет.
  await expect(page.getByRole('radio', { name: 'Другой' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Мужской' }).click()
  await expect(page.getByRole('radio', { name: 'Мужской' })).toHaveAttribute('aria-checked', 'true')
  await next.click()
  // Уровень: «Бегаю без остановки» с цифрами.
  await page.getByRole('radio', { name: 'Бегаю без остановки' }).click()
  await page.getByLabel('Самая длинная пробежка, км').fill('8')
  await page.getByLabel('Сколько раз в неделю бегаешь').fill('1')
  await expect(page.getByText(/Начнём с этапа «10 км»/)).toBeVisible()
  await next.click()
  await next.click()
  await page.getByRole('radio', { name: /Марафон/ }).click()
  await next.click()
  await next.click()
  await page.getByRole('button', { name: /Открыть/ }).click()
  await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible()

  // Все проблемные экраны открываются.
  await page.getByRole('link', { name: 'Спросить тренера' }).click()
  await expect(page.getByRole('heading', { name: 'ИИ-тренер' })).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: 'Свободная пробежка с GPS' }).click()
  await expect(page.getByText('Свободная пробежка')).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: 'Ещё' }).click()
  await expect(page.getByRole('heading', { name: 'Ещё' })).toBeVisible()

  // Таймер тренировки: открываем первую тренировку из плана.
  await page.goto('/plan')
  const workoutLink = page.locator('a[href*="/workout/"]').first()
  // Список приходит из базы, поэтому дожидаемся его и переходим по адресу ссылки.
  await expect(workoutLink).toBeVisible()
  await page.goto((await workoutLink.getAttribute('href')) ?? '/plan')
  await page.getByRole('button', { name: /Начать с таймером/ }).click()
  await expect(page.getByText('Приготовься')).toBeVisible()

  // В силовой тренировке видно конкретные упражнения, а не просто «ОФП».
  await page.goto('/plan')
  const strength = page.locator('a[href*="/workout/"]', { hasText: 'ОФП' }).first()
  await expect(strength).toBeVisible()
  await page.goto((await strength.getAttribute('href')) ?? '/plan')
  await expect(page.getByText('Ягодичный мост')).toBeVisible()

  expect(errors).toEqual([])
})
