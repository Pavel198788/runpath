import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Обёртка экрана: отступы, ширина под телефон, место под нижнюю навигацию. */
export function Page({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={cn('mx-auto w-full max-w-lg px-4 pt-4 pb-24', className)} {...props} />
}
