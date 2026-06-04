'use client'

import { HelpCircleIcon } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Orden = posición real en la matriz (grilla 2×2 espeja el gráfico):
//   Acertijo ↖   Estrella ↗
//   Perro    ↙   Caballito ↘
const CUADRANTES = [
  {
    label: 'Acertijo',
    pos: 'arriba a la izquierda',
    color: '#D97706',
    resumen: 'Deja mucho pero se vende poco. Oportunidad escondida.',
    accion:
      'Reposicionarlo en el menú, rebautizarlo, sugerirlo activamente, armar combos.',
  },
  {
    label: 'Estrella',
    pos: 'arriba a la derecha',
    color: '#059669',
    resumen: 'Se vende mucho y deja mucho. Lo mejor de la carta.',
    accion:
      'Protegerlo y darle visibilidad: ubicación destacada en el menú, que el mozo lo recomiende, foto linda, disponibilidad asegurada.',
  },
  {
    label: 'Perro',
    pos: 'abajo a la izquierda',
    color: '#E11D48',
    resumen: 'Se vende poco y deja poco.',
    accion: 'Candidato a salir de la carta o a rediseñarse fuerte.',
  },
  {
    label: 'Caballito',
    pos: 'abajo a la derecha',
    color: '#2563EB',
    resumen: 'Se vende mucho pero deja poco. Tu imán de clientes.',
    accion:
      'Mejorar su margen sin asustar al que ya lo pide: subir precio de a poco (test de elasticidad), bajar costo de insumo, o reducir porción levemente.',
  },
]

export function MenuEngineeringHelp() {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Qué es el Menu Engineering"
        className="focus-ring grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HelpCircleIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-6 sm:max-w-2xl">
        <DialogHeader>
          <p className="text-eyebrow">Menu Engineering</p>
          <DialogTitle className="font-display text-2xl tracking-tight">
            <span className="italic">¿Qué</span> es esta matriz?
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-6 text-sm leading-relaxed text-foreground/80">
          <p>
            Es una herramienta para decidir qué hacer con cada producto de tu carta. Cruza dos
            preguntas: <strong className="font-medium text-foreground">¿cuánto se vende?</strong> y{' '}
            <strong className="font-medium text-foreground">¿cuánto deja de ganancia?</strong> Cada
            burbuja es un producto, y según dónde caiga, sabés qué palanca conviene mover.
          </p>

          <section className="space-y-2">
            <h3 className="text-eyebrow">Los dos ejes</h3>
            <p>
              <strong className="font-medium text-foreground">Horizontal — Unidades vendidas</strong>{' '}
              (popularidad): cuánta gente lo pide. A la derecha los más vendidos; a la izquierda los
              que casi no salen.
            </p>
            <p>
              <strong className="font-medium text-foreground">Vertical — Margen unitario</strong>{' '}
              (rentabilidad): cuánta ganancia deja cada unidad, ya descontado lo que cuesta
              producirla. Arriba los que más dejan; abajo los que dejan poco.
            </p>
            <p className="text-muted-foreground">
              Las líneas punteadas marcan el promedio de cada eje y dividen la carta en cuatro zonas.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-eyebrow">Los cuatro cuadrantes</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {CUADRANTES.map((q) => (
                <div
                  key={q.label}
                  className="rounded-lg border border-border p-3"
                  style={{ backgroundColor: `${q.color}0d` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: q.color }} />
                    <span className="text-sm font-semibold" style={{ color: q.color }}>
                      {q.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{q.pos}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-foreground/80">{q.resumen}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">→ </span>
                    {q.accion}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-eyebrow">La lectura que podés hacer</h3>
            <p>
              No se trata de tener todo en Estrella. Cada cuadrante pide una acción distinta: las
              Estrellas se cuidan, los Caballitos se exprimen, los Acertijos se empujan y los Perros
              se revisan.
            </p>
            <p>
              La gracia es ver el <strong className="font-medium text-foreground">movimiento</strong>:
              un Acertijo bien promocionado puede volverse Estrella, y un Caballito bien ajustado
              también. La matriz no es una foto fija, es un mapa de hacia dónde mover cada producto.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
