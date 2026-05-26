import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  /** Etiqueta corta sobre el título — uppercase tracking-editorial. */
  eyebrow: string
  /** Título de la página. Las palabras envueltas en `<i>` o `<span className="italic">` se muestran en italic Fraunces. */
  title: ReactNode
  /** Texto descriptivo opcional debajo del título. */
  description?: ReactNode
  /** Slot a la derecha del header (botones de acción, filtros, etc.). */
  actions?: ReactNode
  /** Tamaño visual. `lg` (default) para dashboards/secciones principales; `md` para listas/CRUD. */
  size?: 'md' | 'lg'
  className?: string
}

const SIZE = {
  md: 'text-3xl md:text-4xl',
  lg: 'text-5xl md:text-6xl',
} as const

/**
 * Header de página unificado para todas las rutas de la app.
 *
 *   <PageHeader
 *     eyebrow="Alertas"
 *     title={<><span className="italic">Pagos</span> a proveedores</>}
 *     description="Reglas activas evaluadas contra las compras pendientes."
 *     actions={<Button>Nueva</Button>}
 *   />
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = 'lg',
  className,
}: Props) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-6 pb-2', className)}>
      <div className="space-y-1">
        <p className="text-eyebrow">{eyebrow}</p>
        <h1 className={cn('font-display leading-[0.95] tracking-tight', SIZE[size])}>
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
