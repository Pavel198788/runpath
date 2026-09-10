import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { Badge, Button, Card, Page, PageHeader } from '@/ui'
import { RECIPES } from '@content/nutrition'
import type { RecipeTagId } from '@content/nutrition/schema'
import { addNutritionEntry } from '@/data/repositories/nutritionRepo'
import { todayIso } from '@/domain/dates/dates'
import { cn } from '@/lib/cn'

const TAGS: Array<RecipeTagId | 'all'> = [
  'all',
  'before_run',
  'after_run',
  'long_run',
  'during_run',
  'breakfast',
  'dinner',
  'snack',
  'vegetarian',
  'recovery',
]

export default function RecipesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tag, setTag] = useState<RecipeTagId | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const list = tag === 'all' ? RECIPES : RECIPES.filter((r) => r.tags.includes(tag))

  return (
    <Page className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('nutrition.recipesTitle')} />
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tg) => (
          <button
            key={tg}
            type="button"
            aria-pressed={tag === tg}
            onClick={() => setTag(tg)}
            className={cn(
              'min-h-10 rounded-full border px-3 text-sm',
              tag === tg ? 'border-accent bg-accent/10 font-medium' : 'border-border',
            )}
          >
            {t(`nutrition.recipeTags.${tg}`)}
          </button>
        ))}
      </div>
      {list.map((r) => {
        const isOpen = open === r.id
        return (
          <Card key={r.id} className="space-y-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.id)}
              className="flex w-full items-start justify-between gap-2 text-left"
            >
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="text-muted text-sm">
                  {r.perServing.kcal} {t('nutrition.calories')} · У {r.perServing.carbs} Б{' '}
                  {r.perServing.protein} Ж {r.perServing.fat} ·{' '}
                  {t('nutrition.minutesN', { count: r.minutes })}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'text-muted size-5 shrink-0 transition-transform',
                  isOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            <div className="flex flex-wrap gap-1">
              {r.tags.map((tg) => (
                <Badge key={tg}>{t(`nutrition.recipeTags.${tg}`)}</Badge>
              ))}
            </div>
            {isOpen && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 font-medium">
                    {t('nutrition.ingredients')} · {t('nutrition.servingsN', { count: r.servings })}
                  </p>
                  <ul className="text-muted list-disc pl-5">
                    {r.ingredients.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-medium">{t('nutrition.steps')}</p>
                  <ol className="text-muted list-decimal pl-5">
                    {r.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    void addNutritionEntry(todayIso(), {
                      foodId: null,
                      recipeId: r.id,
                      name: r.name,
                      amount: 1,
                      kcal: r.perServing.kcal,
                      protein: r.perServing.protein,
                      fat: r.perServing.fat,
                      carbs: r.perServing.carbs,
                    }).then(() => setAdded(r.id))
                  }}
                >
                  {added === r.id ? t('log.saved') : t('nutrition.addToDiary')}
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </Page>
  )
}
