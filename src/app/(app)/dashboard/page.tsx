import Link from 'next/link'
import { ArrowUpRightIcon, SparklesIcon } from 'lucide-react'

const SHORTCUTS = [
  { href: '/operacion', label: 'Operación diaria', hint: 'Producción y ventas del día' },
  { href: '/proveedores', label: 'Proveedores', hint: 'Cuentas y compras' },
  { href: '/caja', label: 'Caja', hint: 'Flujo del mes' },
  { href: '/alertas', label: 'Alertas', hint: 'Balanza IVA y reglas de pago' },
]

function todayLabel(): string {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card px-8 py-12 md:px-12 md:py-16">
        {/* Decor: oliva gradient blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-[0.18]"
          style={{
            background:
              'radial-gradient(circle at center, oklch(0.55 0.18 130) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground">
            <SparklesIcon className="size-3" />
            {todayLabel()}
          </span>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
            Buen día,
            <br />
            <span className="italic text-primary">cocina activa.</span>
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            El panel resumen del negocio aparece acá. Por ahora es un espacio en blanco —
            mientras tanto, salt&aacute; directo a cualquier m&oacute;dulo.
          </p>
        </div>
      </section>

      {/* Shortcut bento */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div>
              <span className="text-xs font-medium tabular-nums uppercase tracking-wider text-muted-foreground">
                0{i + 1}
              </span>
              <h3 className="mt-1.5 text-lg font-medium">{s.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.hint}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Abrir</span>
              <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </section>

      {/* Placeholder bento — donde vendrán métricas reales (M4) */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="col-span-2 rounded-2xl border border-dashed border-border bg-card/40 p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Próximamente
          </p>
          <p className="mt-2 font-display text-2xl text-foreground/70">
            Métricas de operación
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ventas vs. proyección, margen del día, productos top.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Próximamente
          </p>
          <p className="mt-2 font-display text-2xl text-foreground/70">Alertas activas</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Insumos por debajo del stock crítico.
          </p>
        </div>
      </section>
    </div>
  )
}
