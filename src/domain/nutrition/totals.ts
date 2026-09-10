export interface NutritionTotals {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

interface Entry {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export function totalsOf(entries: Entry[]): NutritionTotals {
  return entries.reduce(
    (t, e) => ({
      kcal: t.kcal + e.kcal,
      protein: t.protein + e.protein,
      fat: t.fat + e.fat,
      carbs: t.carbs + e.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  )
}
