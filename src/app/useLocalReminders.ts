import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSettings } from '@/data/repositories/settingsRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { workoutsOnDate } from '@/data/repositories/workoutRepo'
import { todayIso } from '@/domain/dates/dates'
import { minutesOf, workoutTitle } from '@/features/workout/workoutText'

/**
 * Локальные напоминания без сервера. Честное ограничение: срабатывают только пока
 * приложение открыто (вкладка/окно живы) — раз в минуту проверяем время.
 * Настоящие push-уведомления — этап B (Web Push через сервер).
 */
export function useLocalReminders() {
  const { t } = useTranslation()
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const check = async () => {
      const settings = await getSettings()
      if (!settings.remindersEnabled || Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (hhmm !== settings.reminderTime) return
      const today = todayIso(now)
      const key = `runpath-reminded-${today}`
      try {
        if (localStorage.getItem(key)) return
      } catch {
        /* приватный режим */
      }
      const plan = await getActivePlan()
      if (!plan) return
      const pending = (await workoutsOnDate(plan.id, today)).filter((w) => w.status === 'planned')
      const main = pending.find((w) => w.type !== 'strength') ?? pending[0]
      if (!main) return
      const body = t('reminders.body', {
        title: workoutTitle(main, t),
        minutes: minutesOf(main.estimatedSeconds),
      })
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg)
        await reg.showNotification('RunPath', {
          body,
          icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          tag: 'runpath-daily',
        })
      else
        new Notification('RunPath', { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` })
      try {
        localStorage.setItem(key, '1')
      } catch {
        /* ignore */
      }
    }
    const id = setInterval(() => void check(), 60_000)
    void check()
    return () => clearInterval(id)
  }, [t])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}
