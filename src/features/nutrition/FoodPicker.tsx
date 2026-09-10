import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardTitle, Field, Input } from '@/ui'
import { FOODS, RECIPES } from '@content/nutrition'
import { addNutritionEntry } from '@/data/repositories/nutritionRepo'

interface Props {
  date: string
  onClose: () => void
}

type Pick =
  { kind: 'food'; id: string } | { kind: 'recipe'; id: string } | { kind: 'custom' } | null

/** Поиск по продуктам и рецептам, ввод количества, добавление в дневник. */
export function FoodPicker({ date, onClose }: Props) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Pick>(null)
  const [amount, setAmount] = useState('100')
  const [custom, setCustom] = useState({ name: '', kcal: '', carbs: '', protein: '', fat: '' })

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { foods: [], recipes: [] }
    return {
      foods: FOODS.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 12),
      recipes: RECIPES.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6),
    }
  }, [query])

  const food = picked?.kind === 'food' ? FOODS.find((f) => f.id === picked.id) : undefined
  const recipe = picked?.kind === 'recipe' ? RECIPES.find((r) => r.id === picked.id) : undefined

  const save = async () => {
    const n = Number(amount.replace(',', '.'))
    if (food && n > 0) {
      const k = n / 100
      await addNutritionEntry(date, {
        foodId: food.id,
        recipeId: null,
        name: food.name,
        amount: n,
        kcal: Math.round(food.kcal * k),
        protein: Math.round(food.protein * k),
        fat: Math.round(food.fat * k),
        carbs: Math.round(food.carbs * k),
      })
    } else if (recipe && n > 0) {
      await addNutritionEntry(date, {
        foodId: null,
        recipeId: recipe.id,
        name: recipe.name,
        amount: n,
        kcal: Math.round(recipe.perServing.kcal * n),
        protein: Math.round(recipe.perServing.protein * n),
        fat: Math.round(recipe.perServing.fat * n),
        carbs: Math.round(recipe.perServing.carbs * n),
      })
    } else if (picked?.kind === 'custom' && custom.name.trim()) {
      await addNutritionEntry(date, {
        foodId: null,
        recipeId: null,
        name: custom.name.trim(),
        amount: 1,
        kcal: Number(custom.kcal) || 0,
        protein: Number(custom.protein) || 0,
        fat: Number(custom.fat) || 0,
        carbs: Number(custom.carbs) || 0,
      })
    } else return
    onClose()
  }

  return (
    <Card className="space-y-3">
      <CardTitle>{t('nutrition.addFood')}</CardTitle>
      {!picked && (
        <>
          <Field label={t('nutrition.search')}>
            <Input
              autoFocus
              value={query}
              placeholder={t('nutrition.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {results.foods.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked({ kind: 'food', id: f.id })
                    setAmount('100')
                  }}
                  className="hover:bg-surface-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left"
                >
                  <span>{f.name}</span>
                  <span className="text-muted text-xs">
                    {f.kcal} {t('nutrition.calories')} / 100 {t(`nutrition.${f.per}`)}
                  </span>
                </button>
              </li>
            ))}
            {results.recipes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked({ kind: 'recipe', id: r.id })
                    setAmount('1')
                  }}
                  className="hover:bg-surface-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left"
                >
                  <span>🍳 {r.name}</span>
                  <span className="text-muted text-xs">
                    {r.perServing.kcal} {t('nutrition.calories')} / {t('nutrition.perServing')}
                  </span>
                </button>
              </li>
            ))}
            {query.trim().length >= 2 &&
              results.foods.length === 0 &&
              results.recipes.length === 0 && (
                <li className="text-muted px-2 py-2 text-sm">{t('nutrition.noResults')}</li>
              )}
          </ul>
          <div className="flex gap-2">
            <Button variant="outline" fullWidth onClick={() => setPicked({ kind: 'custom' })}>
              {t('nutrition.custom')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      )}

      {(food || recipe) && (
        <>
          <p className="font-medium">{food?.name ?? recipe?.name}</p>
          <Field
            label={`${t('nutrition.amount')}, ${food ? t(`nutrition.${food.per}`) : t('nutrition.servings')}`}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button fullWidth onClick={() => void save()}>
              {t('nutrition.add')}
            </Button>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              {t('common.back')}
            </Button>
          </div>
        </>
      )}

      {picked?.kind === 'custom' && (
        <>
          <Field label={t('nutrition.customName')}>
            <Input
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('nutrition.customKcal')}>
              <Input
                type="number"
                inputMode="numeric"
                value={custom.kcal}
                onChange={(e) => setCustom({ ...custom, kcal: e.target.value })}
              />
            </Field>
            <Field label={t('nutrition.customCarbs')}>
              <Input
                type="number"
                inputMode="numeric"
                value={custom.carbs}
                onChange={(e) => setCustom({ ...custom, carbs: e.target.value })}
              />
            </Field>
            <Field label={t('nutrition.customProtein')}>
              <Input
                type="number"
                inputMode="numeric"
                value={custom.protein}
                onChange={(e) => setCustom({ ...custom, protein: e.target.value })}
              />
            </Field>
            <Field label={t('nutrition.customFat')}>
              <Input
                type="number"
                inputMode="numeric"
                value={custom.fat}
                onChange={(e) => setCustom({ ...custom, fat: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button fullWidth disabled={!custom.name.trim()} onClick={() => void save()}>
              {t('nutrition.add')}
            </Button>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              {t('common.back')}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
