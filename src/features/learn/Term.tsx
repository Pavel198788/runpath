import { useState } from 'react'
import { GLOSSARY } from '@content/index'

/** Термин с подсказкой из глоссария: пунктирное подчёркивание, по нажатию — объяснение. */
export function Term({ id, children }: { id: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const term = GLOSSARY.find((g) => g.id === id)
  if (!term) return <>{children}</>
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-0 border-b border-dotted border-current font-medium"
      >
        {children ?? term.term}
      </button>
      {open && (
        <span
          role="tooltip"
          className="bg-surface absolute left-0 z-10 mt-1 block w-64 rounded-xl border border-border p-3 text-sm shadow-lg"
        >
          <span className="block font-semibold">{term.term}</span>
          <span className="text-muted block">{term.long}</span>
        </span>
      )}
    </span>
  )
}
