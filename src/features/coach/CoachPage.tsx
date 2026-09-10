import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Send, Square } from 'lucide-react'
import { Button, Card, CardText, Field, Input, Page, PageHeader, Textarea } from '@/ui'
import { getSettings } from '@/data/repositories/settingsRepo'
import { db } from '@/data/db'
import { touch, withMeta } from '@/data/repositories/helpers'
import type { AiConversation } from '@/data/entities'
import { createAiProvider, type AiMessage } from '@/ai/providers'
import { COACH_SYSTEM_PROMPT } from '@/ai/coachSystemPrompt'
import { buildCoachContext } from '@/ai/context'
import {
  applySuggestion,
  checkSuggestion,
  extractSuggestions,
  type Suggestion,
} from '@/ai/suggestions'
import { cn } from '@/lib/cn'

/** Чат с ИИ-тренером (BYOK). Контекст собирается локально и отправляется вместе с первым сообщением. */
export default function CoachPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settings = useLiveQuery(getSettings)
  const conversation = useLiveQuery(
    async () =>
      (
        await db.aiConversations
          .filter((c) => c.deletedAt === null)
          .reverse()
          .sortBy('updatedAt')
      ).at(-1) ?? null,
  )
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<
    Array<{ s: Suggestion; ok: boolean; reason?: string; applied?: boolean }>
  >([])
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [conversation?.messages.length, streaming])

  if (settings === undefined || conversation === undefined)
    return <Page>{t('common.loading')}</Page>
  const provider = createAiProvider(settings)

  const send = async (text: string) => {
    if (!provider || !text.trim() || busy) return
    setBusy(true)
    setError(null)
    setPending([])
    const now = new Date().toISOString()
    const conv: AiConversation =
      conversation ?? withMeta<AiConversation>({ title: text.slice(0, 40), messages: [] })
    const userMsg = { role: 'user' as const, content: text.trim(), at: now }
    const withUser = touch(conv, { messages: [...conv.messages, userMsg] })
    await db.aiConversations.put(withUser)
    setInput('')

    // Контекст — в первое сообщение пользователя каждого запроса (модель видит свежие данные).
    const context = await buildCoachContext()
    const history: AiMessage[] = withUser.messages
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }))
    const last = history[history.length - 1]!
    history[history.length - 1] = { role: 'user', content: `${context}\n\nВОПРОС: ${last.content}` }

    const controller = new AbortController()
    abortRef.current = controller
    let full = ''
    try {
      for await (const chunk of provider.stream(
        { system: COACH_SYSTEM_PROMPT, messages: history, maxTokens: 1024 },
        controller.signal,
      )) {
        full += chunk
        setStreaming(full)
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e))
    }
    const { text: clean, suggestions } = extractSuggestions(full)
    if (clean) {
      await db.aiConversations.put(
        touch(withUser, {
          messages: [
            ...withUser.messages,
            { role: 'assistant', content: clean, at: new Date().toISOString() },
          ],
        }),
      )
    }
    const checked = await Promise.all(
      suggestions.map(async (s) => {
        const c = await checkSuggestion(s)
        return c.ok ? { s, ok: true } : { s, ok: false, reason: c.reason }
      }),
    )
    setPending(checked)
    setStreaming('')
    setBusy(false)
  }

  const stop = () => abortRef.current?.abort()
  const reset = async () => {
    if (conversation)
      await db.aiConversations.put(touch(conversation, { deletedAt: new Date().toISOString() }))
    setPending([])
  }

  return (
    <Page className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader
        title={t('coach.title')}
        action={
          conversation ? (
            <Button size="sm" variant="ghost" onClick={() => void reset()}>
              {t('coach.newChat')}
            </Button>
          ) : undefined
        }
      />

      {!provider && <SetupCard />}

      {provider && (
        <>
          <CardText className="text-xs">{t('coach.disclaimer')}</CardText>
          {(!conversation || conversation.messages.length === 0) && (
            <div className="flex flex-wrap gap-2">
              {(['why_today', 'week_review', 'nutrition', 'motivation'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => void send(t(`coach.quick.${k}`))}
                  className="bg-surface min-h-10 rounded-full border border-border px-3 text-sm"
                >
                  {t(`coach.quick.${k}`)}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {conversation?.messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[90%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-accent text-accent-fg ml-auto'
                    : 'bg-surface border border-border',
                )}
              >
                {m.content}
              </div>
            ))}
            {streaming && (
              <div className="bg-surface max-w-[90%] rounded-2xl border border-border px-4 py-2 text-sm whitespace-pre-wrap">
                {streaming}
              </div>
            )}
            {error && <CardText className="text-danger text-sm">{error}</CardText>}
            <div ref={bottomRef} />
          </div>

          {pending.length > 0 && (
            <Card className="border-accent space-y-2">
              <p className="font-medium">{t('coach.suggestions')}</p>
              {pending.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {t(`coach.action.${p.s.action}`, { date: 'date' in p.s ? p.s.date : '' })}
                    {p.s.reason && <span className="text-muted"> — {p.s.reason}</span>}
                    {!p.ok && (
                      <span className="text-danger block text-xs">
                        {t(`coach.reject.${p.reason ?? 'not_found'}`)}
                      </span>
                    )}
                  </span>
                  {p.ok && !p.applied && (
                    <Button
                      size="sm"
                      onClick={() =>
                        void applySuggestion(p.s).then(() =>
                          setPending((list) =>
                            list.map((x, j) => (j === i ? { ...x, applied: true } : x)),
                          ),
                        )
                      }
                    >
                      {t('adapt.apply')}
                    </Button>
                  )}
                  {p.applied && <span className="text-success text-xs">{t('coach.applied')}</span>}
                </div>
              ))}
            </Card>
          )}

          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              placeholder={t('coach.placeholder')}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-12 flex-1"
              rows={2}
            />
            {busy ? (
              <Button variant="danger" onClick={stop} aria-label={t('coach.stop')}>
                <Square className="size-5" aria-hidden />
              </Button>
            ) : (
              <Button
                onClick={() => void send(input)}
                disabled={!input.trim()}
                aria-label={t('coach.send')}
              >
                <Send className="size-5" aria-hidden />
              </Button>
            )}
          </div>
        </>
      )}
    </Page>
  )
}

function SetupCard() {
  const { t } = useTranslation()
  const settings = useLiveQuery(getSettings)
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  if (!settings) return null
  const save = async () => {
    const { updateSettings } = await import('@/data/repositories/settingsRepo')
    await updateSettings({
      aiProvider: provider,
      aiApiKey: key.trim(),
      aiBaseUrl: baseUrl.trim(),
      aiModel: model.trim(),
    })
  }
  return (
    <Card className="space-y-3">
      <CardText>{t('coach.setupHint')}</CardText>
      <CardText className="text-warning text-sm">{t('coach.keyRisk')}</CardText>
      <div className="grid grid-cols-2 gap-2">
        {(['anthropic', 'openai'] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={provider === p}
            onClick={() => setProvider(p)}
            className={cn(
              'min-h-11 rounded-xl border text-sm font-medium',
              provider === p ? 'border-accent bg-accent/10' : 'border-border',
            )}
          >
            {t(`coach.provider.${p}`)}
          </button>
        ))}
      </div>
      <Field label={t('coach.apiKey')}>
        <Input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </Field>
      {provider === 'openai' && (
        <Field label={t('coach.baseUrl')} hint="https://api.openai.com/v1">
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </Field>
      )}
      <Field
        label={t('coach.model')}
        hint={provider === 'anthropic' ? 'claude-sonnet-5' : 'gpt-4o-mini'}
      >
        <Input value={model} onChange={(e) => setModel(e.target.value)} />
      </Field>
      <Button fullWidth disabled={key.trim().length < 6} onClick={() => void save()}>
        {t('common.save')}
      </Button>
    </Card>
  )
}
