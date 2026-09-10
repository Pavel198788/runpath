import { describe, expect, it } from 'vitest'
import { FOODS, RECIPES } from './index'
import { FoodSchema, RecipeSchema } from './schema'

describe('контент питания', () => {
  it('продукты валидны, id уникальны, калории сходятся с БЖУ (±25%)', () => {
    const ids = new Set<string>()
    for (const f of FOODS) {
      const r = FoodSchema.safeParse(f)
      expect(r.success, `${f.name}: ${JSON.stringify(r.success ? '' : r.error.issues)}`).toBe(true)
      expect(ids.has(f.id), `дубль id ${f.id}`).toBe(false)
      ids.add(f.id)
      const computed = f.protein * 4 + f.fat * 9 + f.carbs * 4
      // Алкоголь даёт калории вне БЖУ — напитки не сверяем.
      if (f.kcal > 20 && f.category !== 'drinks')
        expect(
          Math.abs(computed - f.kcal) / f.kcal,
          `${f.name}: ${computed} vs ${f.kcal}`,
        ).toBeLessThan(0.25)
    }
    expect(FOODS.length).toBeGreaterThanOrEqual(250)
  })

  it('рецепты валидны и покрывают ключевые теги', () => {
    for (const r of RECIPES) {
      const res = RecipeSchema.safeParse(r)
      expect(res.success, `${r.name}: ${JSON.stringify(res.success ? '' : res.error.issues)}`).toBe(
        true,
      )
    }
    expect(RECIPES.length).toBeGreaterThanOrEqual(30)
    for (const tag of ['before_run', 'after_run', 'long_run', 'vegetarian', 'during_run']) {
      expect(
        RECIPES.some((r) => r.tags.includes(tag as never)),
        tag,
      ).toBe(true)
    }
  })
})
