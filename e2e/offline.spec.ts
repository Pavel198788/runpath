import { expect, test } from '@playwright/test'

/**
 * Сценарий «авиарежим»: открыть приложение онлайн (service worker кэширует статику),
 * затем отключить сеть и убедиться, что экраны открываются и данные сохраняются.
 */
test('приложение работает офлайн после первой загрузки', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible()
  // Ждём, пока service worker возьмёт страницу под контроль.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 30_000,
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible()

  // Навигация по вкладкам офлайн (ленивые чанки должны быть в кэше).
  await page.getByRole('link', { name: 'Ещё' }).click()
  await expect(page.getByRole('heading', { name: 'Ещё' })).toBeVisible()
  await page.getByRole('link', { name: 'План' }).click()
  await expect(page.getByRole('heading', { name: 'План' })).toBeVisible()

  // Данные пишутся в IndexedDB без сети: смена единиц сохраняется после перезагрузки.
  await page.getByRole('link', { name: 'Ещё' }).click()
  const miles = page.getByRole('radio', { name: 'Мили' })
  await miles.click()
  // Ждём, пока запись в базу дойдёт до интерфейса, и только потом перезагружаем.
  await expect(miles).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await page.getByRole('link', { name: 'Ещё' }).click()
  await expect(page.getByRole('radio', { name: 'Мили' })).toHaveAttribute('aria-checked', 'true')
  await context.setOffline(false)
})

test('онбординг строит план', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('checkbox').check()
  const next = page.getByRole('button', { name: 'Продолжить' })
  await next.click() // о себе
  await next.click()
  await page.getByRole('radio', { name: /30 минут/ }).click()
  await next.click()
  await next.click() // здоровье
  await page.getByRole('radio', { name: /Марафон/ }).click()
  await next.click()
  await next.click() // дни
  await expect(page.getByText('Твой план готов')).toBeVisible()
  await page.getByRole('button', { name: /Открыть/ }).click()
  await expect(page.getByRole('heading', { name: 'Сегодня' })).toBeVisible()
  await expect(page.getByText(/Неделя 1 из|План стартует/)).toBeVisible()
})
