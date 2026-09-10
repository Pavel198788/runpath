import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge, Card, CardText, CardTitle, Page, PageHeader } from '@/ui'
import { GLOSSARY, LESSONS } from '@content/index'
import { getActivePlan } from '@/data/repositories/planRepo'
import { addDaysIso, todayIso } from '@/domain/dates/dates'
import { cn } from '@/lib/cn'
import { lessonOfWeek } from './lessonOfWeek'

export default function LearnPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const [openTerm, setOpenTerm] = useState<string | null>(null)

  const today = todayIso()
  const week = plan?.weeks.find((w) => today >= w.startDate && today < addDaysIso(w.startDate, 7))
  const phaseStart = plan?.phases.find((p) => p.phase === week?.phase)?.fromWeek ?? 0
  const current = week ? lessonOfWeek(week.phase, week.index - phaseStart) : null

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('learn.title')} />

      {current && (
        <Card className="border-accent">
          <p className="text-muted text-xs">{t('learn.lessonOfWeek')}</p>
          <CardTitle>{current.title}</CardTitle>
          <CardText className="mt-1 text-sm">{current.summary}</CardText>
          <Link to={`/learn/${current.id}`} className="text-accent mt-2 block text-sm font-medium">
            {t('learn.read')}
          </Link>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('learn.course')}</h2>
        <CardText className="text-sm">{t('learn.courseHint')}</CardText>
        {[...LESSONS]
          .sort((a, b) => a.order - b.order)
          .map((l) => (
            <Link
              key={l.id}
              to={`/learn/${l.id}`}
              className="bg-surface flex items-center gap-3 rounded-xl border border-border px-3 py-3"
            >
              <span className="bg-accent/15 text-accent flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {l.order}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.title}</span>
                <span className="text-muted block text-xs">
                  {l.phase === 'any' ? t('learn.phaseAny') : t(`phase.${l.phase}`)} ·{' '}
                  {t('learn.minutes', { count: l.minutes })}
                </span>
              </span>
              <ChevronRight className="text-muted size-5" aria-hidden />
            </Link>
          ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('learn.glossary')}</h2>
        <CardText className="text-sm">{t('learn.glossaryHint')}</CardText>
        {[...GLOSSARY]
          .sort((a, b) => a.term.localeCompare(b.term, 'ru'))
          .map((g) => {
            const isOpen = openTerm === g.id
            return (
              <div key={g.id} className="rounded-xl border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenTerm(isOpen ? null : g.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span>
                    <span className="font-medium">{g.term}</span>
                    <span className="text-muted block text-xs">{g.short}</span>
                  </span>
                  <ChevronDown
                    className={cn('text-muted size-4 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {isOpen && <p className="text-muted px-3 pb-3 text-sm">{g.long}</p>}
              </div>
            )
          })}
      </section>
      <Badge className="hidden">{t('learn.related')}</Badge>
    </Page>
  )
}
