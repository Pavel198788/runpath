import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

interface FieldProps {
  label: string
  hint?: string | undefined
  children: ReactNode
  className?: string | undefined
}

/** Подпись + подсказка + одно поле ввода. Только для input/select/textarea. */
export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}
    </label>
  )
}

/**
 * То же оформление, но для группы кнопок (переключатели, списки выбора).
 * Внутри <label> такие кнопки теряют доступное имя — их не «видят» скринридеры,
 * поэтому здесь обычный блок, а название группы задаёт сам компонент через aria-label.
 */
export function FieldGroup({ label, hint, children, className }: FieldProps) {
  return (
    <div className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted mt-1 block text-xs">{hint}</span>}
    </div>
  )
}

const controlClass =
  'bg-surface-2 w-full min-h-12 rounded-xl border border-border px-4 text-base text-fg outline-none focus:border-accent'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-24 py-3', className)} {...props} />
}
