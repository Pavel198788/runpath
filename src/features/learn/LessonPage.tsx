import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardText, Page, PageHeader } from '@/ui'
import { GLOSSARY, LESSONS } from '@content/index'

export default function LessonPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const lesson = LESSONS.find((l) => l.id === id)
  if (!lesson) return <Page>{t('common.notFound')}</Page>
  const terms = lesson.terms
    .map((tid) => GLOSSARY.find((g) => g.id === tid))
    .filter((g): g is (typeof GLOSSARY)[number] => !!g)

  return (
    <Page className="space-y-4">
      <Link to="/learn" className="text-muted flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> {t('learn.back')}
      </Link>
      <PageHeader
        title={lesson.title}
        subtitle={`${lesson.phase === 'any' ? t('learn.phaseAny') : t(`phase.${lesson.phase}`)} · ${t('learn.minutes', { count: lesson.minutes })}`}
      />
      <CardText className="text-base">{lesson.summary}</CardText>
      {lesson.sections.map((s) => (
        <Card key={s.heading} className="space-y-1">
          <h2 className="font-semibold">{s.heading}</h2>
          <CardText>{s.text}</CardText>
        </Card>
      ))}
      {terms.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">{t('learn.related')}</h2>
          {terms.map((g) => (
            <p key={g.id} className="text-sm">
              <span className="font-medium">{g.term}</span> —{' '}
              <span className="text-muted">{g.short}</span>
            </p>
          ))}
        </Card>
      )}
    </Page>
  )
}
