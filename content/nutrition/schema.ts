import { z } from 'zod'

/** Схемы контента питания. Проверяются тестом при сборке, чтобы правка JSON не сломала приложение. */
export const FoodCategory = z.enum([
  'grains',
  'bread',
  'dairy',
  'eggs',
  'meat',
  'fish',
  'legumes',
  'vegetables',
  'fruits',
  'nuts',
  'sweets',
  'drinks',
  'sport',
  'fats',
])

/** Привычная мера продукта: сколько это в граммах и как называется («1 средний», «горсть»). */
export const PortionSchema = z.object({
  amount: z.number().min(1).max(1000),
  label: z.string().min(1),
})

export const FoodSchema = z.object({
  id: z.string().regex(/^f-[0-9a-f]{8}$/),
  name: z.string().min(2),
  category: FoodCategory,
  per: z.enum(['g', 'ml']),
  portion: PortionSchema,
  kcal: z.number().min(0).max(950),
  protein: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
})

export const RecipeTag = z.enum([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'before_run',
  'after_run',
  'during_run',
  'long_run',
  'recovery',
  'vegetarian',
  'race',
  'carb_load',
  'light',
])

export const RecipeSchema = z.object({
  id: z.string().regex(/^r-[0-9a-f]{8}$/),
  name: z.string().min(2),
  tags: z.array(RecipeTag).min(1),
  servings: z.number().int().min(1),
  minutes: z.number().int().min(1),
  perServing: z.object({
    kcal: z.number().min(0),
    protein: z.number().min(0),
    fat: z.number().min(0),
    carbs: z.number().min(0),
  }),
  ingredients: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(1),
})

export type Food = z.infer<typeof FoodSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type FoodCategoryId = z.infer<typeof FoodCategory>
export type RecipeTagId = z.infer<typeof RecipeTag>
