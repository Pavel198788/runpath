import type { BaseEntity } from './base'

/** «Лёгкий» режим дневника: одна отметка на день. */
export type LightMark = 'normal' | 'little' | 'over'

export interface NutritionEntry {
  id: string
  /** Продукт или рецепт из контента; null — свободная запись. */
  foodId: string | null
  recipeId: string | null
  name: string
  /** Граммы/мл или число порций для рецепта. */
  amount: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** Отметка времени добавления, ISO. */
  at: string
}

export interface NutritionDay extends BaseEntity {
  date: string
  light: LightMark | null
  entries: NutritionEntry[]
  note: string
}
