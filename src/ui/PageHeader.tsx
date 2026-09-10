import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string | undefined
  action?: ReactNode | undefined
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
