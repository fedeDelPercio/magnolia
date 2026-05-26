import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  /** Etiqueta corta sobre el título — uppercase tracking-editorial. */
  eyebrow: string
  /** Título del bloque. Pasar palabras envueltas en `<i>` se mostrarán italic Fraunces. */
  children: ReactNode
  /** Texto secundario alineado al final del header (oculto en mobile). */
  trail?: ReactNode
  /** Tamaño visual del headline. Default `md` (3xl). */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl md:text-5xl',
}

/**
 * Header editorial reutilizable para secciones del dashboard:
 *
 *   <SectionHeader eyebrow="Estructura de costos" trail="…">
 *     <i>Cómo</i> se reparte cada peso
 *   </SectionHeader>
 */
export function SectionHeader({ eyebrow, children, trail, size = 'md', className }: Props) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-baseline justify-between gap-3', className)}>
      <div className="max-w-2xl">
        <p className="text-[10px] font-medium uppercase tracking-editorial text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className={cn('mt-1 font-display leading-tight tracking-tight', SIZE[size])}>
          {children}
        </h2>
      </div>
      {trail && (
        <div className="hidden text-xs text-muted-foreground md:block">{trail}</div>
      )}
    </div>
  )
}
