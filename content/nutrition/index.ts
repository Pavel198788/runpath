import foodsJson from './foods.json'
import recipesJson from './recipes.json'
import type { Food, Recipe } from './schema'

/** Контент вшит в сборку: приложение работает без сервера. Валидность проверяет content.test.ts. */
export const FOODS = foodsJson as Food[]
export const RECIPES = recipesJson as Recipe[]
