import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Apple, CalendarDays, MoreHorizontal, Sun, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'

const items = [
  { to: '/today', key: 'nav.today', Icon: Sun },
  { to: '/plan', key: 'nav.plan', Icon: CalendarDays },
  { to: '/nutrition', key: 'nav.nutrition', Icon: Apple },
  { to: '/progress', key: 'nav.progress', Icon: TrendingUp },
  { to: '/more', key: 'nav.more', Icon: MoreHorizontal },
] as const

/** Нижняя навигация: 4 крупные вкладки, отступ под системную полосу iOS. */
export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav
      aria-label="Основная навигация"
      className="bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t border-border backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ to, key, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              <Icon aria-hidden className="size-6" />
              {t(key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
