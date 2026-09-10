import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { Card, CardText, Page, PageHeader } from '@/ui'
import { SYMPTOMS } from '@content/index'
import type { Symptom } from '@content/schemas'
import { cn } from '@/lib/cn'

const AREAS: Symptom['area'][] = [
  'knee',
  'shin',
  'achilles',
  'foot',
  'calf',
  'hip',
  'back',
  'chest',
  'other',
]

/** Симптом-чекер без диагнозов: зона → типичные картины → что делать и когда к врачу. */
export default function InjuryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [area, setArea] = useState<Symptom['area'] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const list = area ? SYMPTOMS.filter((s) => s.area === area) : []

  return (
    <Page className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('injury.title')} />
      <CardText className="text-sm">{t('injury.hint')}</CardText>
      <p className="text-sm font-medium">{t('injury.pick')}</p>
      <div className="flex flex-wrap gap-2">
        {AREAS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={area === a}
            onClick={() => {
              setArea(a)
              setOpen(null)
            }}
            className={cn(
              'min-h-11 rounded-xl border px-4 text-sm font-medium',
              area === a ? 'border-accent bg-accent/10' : 'border-border',
              a === 'chest' && 'text-danger',
            )}
          >
            {t(`injury.area.${a}`)}
          </button>
        ))}
      </div>
      {list.map((s) => {
        const isOpen = open === s.id
        return (
          <Card key={s.id} className={cn('space-y-2', s.area === 'chest' && 'border-danger')}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : s.id)}
              className="flex w-full items-center justify-between gap-2 text-left font-semibold"
            >
              {s.title}
              <ChevronDown
                className={cn(
                  'text-muted size-5 shrink-0 transition-transform',
                  isOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div className="space-y-3 text-sm">
                {s.area === 'chest' && (
                  <p className="text-danger font-medium">{t('injury.redFlag')}</p>
                )}
                <Section title={t('injury.causes')} items={s.causes} />
                <Section title={t('injury.doNow')} items={s.doNow} />
                <Section title={t('injury.seeDoctor')} items={s.seeDoctor} danger />
                {s.area !== 'chest' && s.area !== 'other' && (
                  <Link
                    to="/exercises?routine=strength_a"
                    className="text-accent block font-medium"
                  >
                    {t('injury.exercisesLink')}
                  </Link>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </Page>
  )
}

function Section({ title, items, danger }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div>
      <p className={cn('mb-1 font-medium', danger && 'text-danger')}>{title}</p>
      <ul className="text-muted list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}
