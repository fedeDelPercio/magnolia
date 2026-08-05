'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { PencilIcon, ChevronDownIcon, UtensilsIcon, ExternalLinkIcon } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

import { recetaSchema, UNITS, UNIT_LABELS, type UnitKind, type RecetaFormValues } from '../schemas'
import { createReceta, updateReceta, fetchRecetaUsadaEn, type RecetaUsadaEn } from '../actions'
import { IngredientesEditor, type IngredientesEditorHandle } from './ingredientes-editor'
import type { RecetaWithIngredientes } from '../queries'
import type { Tables } from '@/types/database'

type Mode = 'view' | 'edit' | 'create'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  receta: RecetaWithIngredientes | null
  mode: Mode
  insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'current_price'>[]
  recetas: (Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'> & { total_cost?: number })[]
}

const DEFAULT_VALUES: RecetaFormValues = {
  name: '',
  category: '',
  yield_qty: 1,
  yield_unit: 'u',
  notes: '',
  ingredientes: [],
}

export function RecetaDialog({ open, onOpenChange, receta, mode, insumos, recetas }: Props) {
  const router = useRouter()
  const form = useForm<RecetaFormValues>({
    resolver: zodResolver(recetaSchema) as Resolver<RecetaFormValues>,
    defaultValues: DEFAULT_VALUES,
  })

  const [editing, setEditing] = useState(mode !== 'view')
  const editorRef = useRef<IngredientesEditorHandle>(null)
  const [usadaEn, setUsadaEn] = useState<RecetaUsadaEn>([])
  const [showUsadaEn, setShowUsadaEn] = useState(false)

  useEffect(() => {
    if (!open || !receta) { setUsadaEn([]); return }
    fetchRecetaUsadaEn(receta.id).then(({ data }) => setUsadaEn(data))
  }, [open, receta])

  useEffect(() => {
    if (!open) return
    setEditing(mode !== 'view')
    form.reset(
      receta
        ? {
            name: receta.name,
            category: receta.category ?? '',
            yield_qty: receta.yield_qty,
            yield_unit: receta.yield_unit,
            notes: receta.notes ?? '',
            ingredientes: receta.receta_ingredientes.map((ri) => ({
              kind: ri.kind,
              insumo_id: ri.insumo_id ?? undefined,
              sub_receta_id: ri.sub_receta_id ?? undefined,
              qty: ri.qty,
              unit: ri.unit,
            })),
          }
        : DEFAULT_VALUES,
    )
    // intentionally only depend on `open` and the identity of the receta —
    // we don't want to reset the form when `editing` flips internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receta?.id, mode])

  const readOnly = !editing
  const isCreate = mode === 'create'

  async function onSubmit(values: RecetaFormValues) {
    const result = receta ? await updateReceta(receta.id, values) : await createReceta(values)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(receta ? 'Receta actualizada' : 'Receta creada')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Nueva receta' : readOnly ? receta?.name ?? 'Receta' : `Editar — ${receta?.name ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        {/* Usada en: productos que contienen esta sub-receta (directa o
            anidada), con cuánto consume cada uno (producción últimos 30 días).
            Sirve para detectar productos donde debería estar y no está. */}
        {!isCreate && receta && (
          <div className="rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowUsadaEn((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <UtensilsIcon className="size-4 text-muted-foreground" />
                Usada en
                {usadaEn.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                    {usadaEn.length}
                  </span>
                )}
              </span>
              <ChevronDownIcon className={`size-4 transition-transform ${showUsadaEn ? 'rotate-180' : ''}`} />
            </button>
            {showUsadaEn && (() => {
              const totalConsumido = usadaEn.reduce((s, p) => s + p.consumido_30d, 0)
              const unitLabel = UNIT_LABELS[receta.yield_unit as UnitKind] ?? receta.yield_unit
              const fmt = (v: number) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unitLabel}`
              return (
                <div className="border-t">
                  {usadaEn.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      Ningún producto usa esta sub-receta — si debería estar en alguno, falta agregarla a su receta.
                    </p>
                  ) : (
                    <div className="divide-y text-sm">
                      {usadaEn.map((p) => {
                        const share = totalConsumido > 0 ? (p.consumido_30d / totalConsumido) * 100 : null
                        return (
                          <div key={p.producto_id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenChange(false)
                                  router.push(`/catalogo/productos?q=${encodeURIComponent(p.producto_name)}`)
                                }}
                                className="flex items-center gap-1 text-left font-medium hover:underline underline-offset-2"
                              >
                                <span className="truncate">{p.producto_name}</span>
                                <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                              </button>
                              <p className="text-xs text-muted-foreground">{fmt(p.qty_por_unidad)} por unidad</p>
                            </div>
                            <div className="text-right">
                              <p className="tabular-nums font-medium">{fmt(p.consumido_30d)}</p>
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {share !== null && p.consumido_30d > 0 ? `${share.toFixed(1)}% · últ. 30 días` : 'sin producción 30d'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <Form {...form}>
          <form
            id="receta-form"
            onSubmit={(e) => {
              // Antes de submittear, hacemos flush del ingrediente pendiente
              // que el user pudo haber dejado en la fila "agregar" sin
              // apretar el boton +. append() de RHF actualiza sincronicamente
              // el form state, asi que handleSubmit lo ve incluido.
              editorRef.current?.flushPending()
              form.handleSubmit(onSubmit)(e)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Base de tarta" disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Tartas, Postres..." disabled={readOnly} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="yield_qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rendimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.001"
                          step="any"
                          disabled={readOnly}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="yield_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={readOnly}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {(v: string | null) => v ? UNIT_LABELS[v as UnitKind] ?? v : null}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u} label={UNIT_LABELS[u]}>
                              {UNIT_LABELS[u]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Temperatura de horno, tiempos de reposo..."
                        className="resize-none"
                        rows={2}
                        disabled={readOnly}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <IngredientesEditor
              ref={editorRef}
              insumos={insumos}
              recetas={recetas}
              currentRecetaId={receta?.id}
              readOnly={readOnly}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (readOnly || isCreate) onOpenChange(false)
              else setEditing(false)
            }}
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {readOnly ? (
            // Workaround: usamos <button> nativo en vez del componente <Button>
            // de Base UI porque dentro de un Dialog con un <form>, su click
            // dispara submit del form aunque tenga type="button".
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PencilIcon className="size-4" />
              Editar
            </button>
          ) : (
            <Button type="submit" form="receta-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
