import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Badge, Button, Card, CardText, Field, Input, Page, PageHeader, ProgressBar } from '@/ui'
import {
  addShoe,
  allShoes,
  retireShoe,
  setDefaultShoe,
  shoeMileageM,
} from '@/data/repositories/shoeRepo'
import { SHOE_REPLACE_KM, shoeState } from '@/domain/shoes/shoes'

export default function ShoesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const shoes = useLiveQuery(async () => {
    const list = await allShoes()
    return Promise.all(list.map(async (s) => ({ shoe: s, mileageM: await shoeMileageM(s) })))
  })
  const [name, setName] = useState('')
  const [initial, setInitial] = useState('0')

  const add = async () => {
    if (!name.trim()) return
    await addShoe(name.trim(), Number(initial) || 0)
    setName('')
    setInitial('0')
  }

  return (
    <Page className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={t('shoes.title')} />
      <CardText className="text-sm">{t('shoes.hint')}</CardText>

      {shoes?.length === 0 && <CardText>{t('shoes.empty')}</CardText>}
      {shoes?.map(({ shoe, mileageM }) => {
        const state = shoeState(mileageM)
        const km = Math.round(mileageM / 1000)
        return (
          <Card key={shoe.id} className={shoe.retiredAt ? 'opacity-60' : ''}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{shoe.name}</span>
              <span className="flex gap-1">
                {shoe.isDefault && <Badge tone="accent">{t('shoes.default')}</Badge>}
                {shoe.retiredAt ? (
                  <Badge>{t('shoes.retired')}</Badge>
                ) : (
                  <Badge
                    tone={state === 'ok' ? 'success' : state === 'warn' ? 'warning' : 'danger'}
                  >
                    {t(`shoes.state.${state}`)}
                  </Badge>
                )}
              </span>
            </div>
            <ProgressBar value={km / SHOE_REPLACE_KM} className="mt-2" label={shoe.name} />
            <p className="text-muted mt-1 text-sm">{t('shoes.mileage', { km })}</p>
            {!shoe.retiredAt && (
              <div className="mt-2 flex gap-2">
                {!shoe.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => void setDefaultShoe(shoe.id)}>
                    {t('shoes.makeDefault')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void retireShoe(shoe.id)}>
                  {t('shoes.retire')}
                </Button>
              </div>
            )}
          </Card>
        )
      })}

      <Card className="space-y-3">
        <Field label={t('shoes.name')}>
          <Input
            value={name}
            placeholder="Asics Novablast"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t('shoes.initialKm')}>
          <Input
            type="number"
            inputMode="numeric"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </Field>
        <Button fullWidth disabled={!name.trim()} onClick={() => void add()}>
          {t('shoes.add')}
        </Button>
      </Card>
    </Page>
  )
}
