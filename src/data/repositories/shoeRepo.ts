import { db } from '../db'
import type { Shoe } from '../entities'
import { touch, withMeta } from './helpers'

export async function allShoes(): Promise<Shoe[]> {
  return db.shoes.filter((s) => s.deletedAt === null).toArray()
}

export async function addShoe(name: string, initialKm: number): Promise<Shoe> {
  const others = await allShoes()
  const shoe = withMeta<Shoe>({
    name,
    initialM: Math.round(initialKm * 1000),
    retiredAt: null,
    isDefault: others.length === 0,
  })
  await db.shoes.put(shoe)
  return shoe
}

export async function setDefaultShoe(id: string): Promise<void> {
  const shoes = await allShoes()
  await db.transaction('rw', db.shoes, async () => {
    for (const s of shoes)
      if (s.isDefault !== (s.id === id)) await db.shoes.put(touch(s, { isDefault: s.id === id }))
  })
}

export async function retireShoe(id: string): Promise<void> {
  const s = await db.shoes.get(id)
  if (s) await db.shoes.put(touch(s, { retiredAt: new Date().toISOString(), isDefault: false }))
}

/** Пробег пары: начальный + все записи с этой парой. */
export async function shoeMileageM(shoe: Shoe): Promise<number> {
  const logs = await db.workoutLogs
    .where('shoeId')
    .equals(shoe.id)
    .filter((l) => l.deletedAt === null)
    .toArray()
  return shoe.initialM + logs.reduce((a, l) => a + (l.distanceM ?? 0), 0)
}
