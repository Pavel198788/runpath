import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Кнопка с крупной тап-зоной (минимум 48px) — приложение открывают на бегу. */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:opacity-90',
        secondary: 'bg-surface-2 text-fg hover:bg-border',
        outline: 'border border-border bg-transparent text-fg hover:bg-surface-2',
        ghost: 'bg-transparent text-fg hover:bg-surface-2',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        md: 'min-h-12 px-5 text-base',
        lg: 'min-h-14 px-6 text-lg',
        sm: 'min-h-11 px-4 text-sm',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  )
}
