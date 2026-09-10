export const SHOE_WARN_KM = 600
export const SHOE_REPLACE_KM = 800

export type ShoeState = 'ok' | 'warn' | 'replace'

export function shoeState(totalM: number): ShoeState {
  const km = totalM / 1000
  if (km >= SHOE_REPLACE_KM) return 'replace'
  if (km >= SHOE_WARN_KM) return 'warn'
  return 'ok'
}
