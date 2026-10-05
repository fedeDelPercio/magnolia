'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  descartarPendientesDeTodosLosDias,
  guardarPendientesDeTodosLosDias,
  hayPendientesEnAlgunDia,
  quitarFila,
  registrarFila,
  registrarGuardadoAlSalir,
} from './guardados-pendientes'

// Guardado automático de una fila de la grilla de Operación.
//
// Reglas (cada una salió de un caso real o del QA del 2026-10-05):
// - Se manda solo lo que la persona tocó (`dirty`), nunca la fila entera: una
//   pestaña vieja no pisa lo que cambió en otra (reasignación, sync de Bistro).
// - Se manda siempre el ÚLTIMO valor tipeado (`latest`), nunca una copia vieja.
// - Un campo deja de estar pendiente solo cuando la base confirmó el guardado
//   y el valor no cambió mientras tanto. Si falla (error o sin conexión), no se
//   pierde nada: queda pendiente, la fila muestra "sin guardar" y se reintenta.
// - Los envíos de una fila van de a uno: el que llega mientras otro está en
//   curso espera y después manda lo último.
// - La fila se anota en el registro del día (guardados-pendientes) para que
//   cerrar el día, traer stock o reasignar fuercen y esperen su guardado.
// - Si la fila sale de pantalla con algo pendiente (botón Atrás del celular,
//   rearmar la grilla), lo pendiente pasa a las "huérfanas": se sigue
//   intentando guardar y, si la fila vuelve a aparecer, lo retoma.

export type ResultadoEnvio = {
  error?: string
  // No se va a poder guardar nunca (por ejemplo, el día ya está cerrado): se
  // descarta en vez de reintentar.
  permanente?: boolean
}

type Opciones<S> = {
  filaId: string
  diaId: string
  // Fecha corta del día ("25/05"), para los avisos de lo que quedó sin guardar
  // después de salir de la pantalla.
  diaFecha?: string
  nombre: string
  inicial: S
  enviar: (estado: S, campos: ReadonlySet<keyof S>) => Promise<ResultadoEnvio>
}

const DEBOUNCE_MS = 700
// Un envío que no responde en este tiempo se trata como fallido (queda
// pendiente y se reintenta): si no, "Cerrar día" esperaba sin límite.
const TIMEOUT_MS = 20000
const REINTENTO_MS = 30000

// Un guardado no se va a poder hacer nunca (día cerrado en otra pestaña): la
// pantalla de ESE día lo escucha para recargarse.
export const EVENTO_GUARDADO_IMPOSIBLE = 'magnolia:guardado-imposible'
export type DetalleGuardadoImposible = { diaId: string; msg: string }

type Enviar = (estado: object, campos: ReadonlySet<PropertyKey>) => Promise<ResultadoEnvio>

async function enviarConTope(enviar: Enviar, estado: object, campos: ReadonlySet<PropertyKey>): Promise<ResultadoEnvio> {
  let t: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      enviar(estado, campos),
      new Promise<ResultadoEnvio>((resolve) => {
        t = setTimeout(() => resolve({ error: 'sin respuesta del servidor' }), TIMEOUT_MS)
      }),
    ])
  } catch {
    return { error: 'sin conexión' }
  } finally {
    clearTimeout(t)
  }
}

// ---------------------------------------------------------------------------
// Huérfanas: lo que una fila dejó sin guardar al salir de pantalla.

type Huerfana = {
  diaId: string
  nombre: string
  diaFecha: string
  campos: Set<PropertyKey>
  valores: Record<PropertyKey, unknown>
  enviar: Enviar
  // Envío que la fila ya había mandado: sale antes que el de acá.
  previo: Promise<void> | null
  // Envío de acá en curso.
  enviando: Promise<void> | null
  // La fila volvió a aparecer y se hizo cargo.
  retomada: boolean
  avisada: boolean
}

const huerfanas = new Map<string, Huerfana>()
let reintentoHuerfanas: ReturnType<typeof setInterval> | undefined

const delDia = (h: Huerfana) => (h.diaFecha ? ` del ${h.diaFecha}` : '')

function intentarHuerfana(filaId: string): Promise<void> {
  const h = huerfanas.get(filaId)
  if (!h) return Promise.resolve()
  if (h.enviando) return h.enviando
  const envio = (async () => {
    if (h.previo) await h.previo
    h.previo = null
    if (h.retomada) return
    const res = await enviarConTope(h.enviar, h.valores, h.campos)
    if (h.retomada) return
    if (!res.error) {
      huerfanas.delete(filaId)
      return
    }
    if (res.permanente) {
      huerfanas.delete(filaId)
      toast.error(`No se guardó ${h.nombre}${delDia(h)}: ${res.error}`, { duration: 15000 })
      return
    }
    if (!h.avisada) {
      h.avisada = true
      toast.error(
        `No se guardó ${h.nombre}${delDia(h)} (${res.error}). Se sigue intentando solo mientras la app esté abierta; si volvés a ese día lo vas a ver marcado "sin guardar".`,
        { duration: 15000 },
      )
    }
  })().finally(() => {
    h.enviando = null
    actualizarReintentoHuerfanas()
  })
  h.enviando = envio
  return envio
}

function reintentarHuerfanas() {
  for (const id of [...huerfanas.keys()]) void intentarHuerfana(id)
}

function avisarAntesDeSalir(e: BeforeUnloadEvent) {
  if (huerfanas.size === 0) return
  reintentarHuerfanas()
  e.preventDefault()
  e.returnValue = ''
}

function actualizarReintentoHuerfanas() {
  if (typeof window === 'undefined') return
  if (huerfanas.size > 0 && reintentoHuerfanas === undefined) {
    reintentoHuerfanas = setInterval(reintentarHuerfanas, REINTENTO_MS)
    window.addEventListener('online', reintentarHuerfanas)
    window.addEventListener('beforeunload', avisarAntesDeSalir)
  } else if (huerfanas.size === 0 && reintentoHuerfanas !== undefined) {
    clearInterval(reintentoHuerfanas)
    reintentoHuerfanas = undefined
    window.removeEventListener('online', reintentarHuerfanas)
    window.removeEventListener('beforeunload', avisarAntesDeSalir)
  }
}

function entregarHuerfana(
  filaId: string,
  nueva: Omit<Huerfana, 'enviando' | 'retomada' | 'avisada'>,
) {
  const anterior = huerfanas.get(filaId)
  huerfanas.set(filaId, {
    ...nueva,
    campos: new Set([...(anterior?.campos ?? []), ...nueva.campos]),
    valores: { ...anterior?.valores, ...nueva.valores },
    previo: anterior?.enviando ?? nueva.previo,
    enviando: null,
    retomada: false,
    avisada: anterior?.avisada ?? false,
  })
  // Se manda en el próximo ciclo: si la fila vuelve a aparecer enseguida (se
  // rearma la grilla) la retoma antes. La pantalla del día siguiente espera
  // este guardado (puede cambiar su stock arrastrado).
  registrarGuardadoAlSalir(
    new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => intentarHuerfana(filaId)),
  )
  actualizarReintentoHuerfanas()
}

/** La fila volvió a aparecer: se hace cargo de lo pendiente. Devuelve lo que hay que esperar antes de mandar. */
function retomarHuerfana(filaId: string, diaId: string): { esperar: Promise<void> | null } | null {
  const h = huerfanas.get(filaId)
  if (!h || h.diaId !== diaId) return null
  h.retomada = true
  huerfanas.delete(filaId)
  actualizarReintentoHuerfanas()
  return { esperar: h.enviando ?? h.previo }
}

/** Descarta lo pendiente de filas desmontadas (al cerrar sesión igual, y en los tests). */
export function descartarHuerfanas() {
  for (const h of huerfanas.values()) h.retomada = true
  huerfanas.clear()
  actualizarReintentoHuerfanas()
}

// Antes de cerrar sesión: sin sesión ya no se puede guardar, y lo que quede se
// guardaría después con la sesión de otra persona.
export function hayAlgoSinGuardar(): boolean {
  return huerfanas.size > 0 || hayPendientesEnAlgunDia()
}

/** Guarda lo de la pantalla y lo de filas que ya no están. Devuelve lo que no se pudo guardar. */
export async function guardarTodoLoPendiente(): Promise<string[]> {
  const enPantalla = await guardarPendientesDeTodosLosDias()
  await Promise.allSettled([...huerfanas.keys()].map((id) => intentarHuerfana(id)))
  return [...enPantalla, ...[...huerfanas.values()].map((h) => h.nombre + delDia(h))]
}

export function descartarTodoLoPendiente() {
  descartarPendientesDeTodosLosDias()
  descartarHuerfanas()
}

// ---------------------------------------------------------------------------

export function useGuardadoFila<S extends object>({ filaId, diaId, diaFecha = '', nombre, inicial, enviar }: Opciones<S>) {
  // Si la fila había salido de pantalla con algo sin guardar, arranca con eso.
  const [arranque] = useState(() => {
    const h = huerfanas.get(filaId)
    if (!h || h.diaId !== diaId) return { estado: inicial, campos: [] as (keyof S)[] }
    const estado = { ...inicial } as Record<PropertyKey, unknown>
    for (const c of h.campos) estado[c] = h.valores[c]
    return { estado: estado as S, campos: [...h.campos] as (keyof S)[] }
  })
  const [local, setLocal] = useState<S>(arranque.estado)
  const [saving, setSaving] = useState(false)
  const [sinGuardar, setSinGuardar] = useState(arranque.campos.length > 0)

  const latestRef = useRef<S>(arranque.estado)
  const dirtyRef = useRef<Set<keyof S>>(new Set(arranque.campos))
  const enVueloRef = useRef<Promise<void> | null>(null)
  const fallidaRef = useRef(false)
  const desmontadaRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enviarRef = useRef(enviar)
  const nombreRef = useRef(nombre)
  const diaIdRef = useRef(diaId)
  const diaFechaRef = useRef(diaFecha)
  useEffect(() => {
    enviarRef.current = enviar
    nombreRef.current = nombre
    diaIdRef.current = diaId
    diaFechaRef.current = diaFecha
  })

  const guardar = useCallback(async (avisar: boolean): Promise<boolean> => {
    clearTimeout(timer.current)
    // Hasta 3 vueltas: si mientras se guardaba se tipeó algo más, se manda eso.
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      while (enVueloRef.current) await enVueloRef.current
      // Fuera de pantalla lo pendiente ya lo maneja el registro de huérfanas.
      if (desmontadaRef.current) return false
      if (dirtyRef.current.size === 0) {
        setSinGuardar(false)
        return true
      }
      const campos = new Set(dirtyRef.current)
      const enviado = { ...latestRef.current }
      let res: ResultadoEnvio = {}
      setSaving(true)
      const envio = (async () => {
        res = await enviarConTope(enviarRef.current as unknown as Enviar, enviado, campos as ReadonlySet<PropertyKey>)
      })()
      enVueloRef.current = envio
      await envio
      enVueloRef.current = null
      if (desmontadaRef.current) return false
      setSaving(false)

      if (res.error) {
        setSinGuardar(true)
        if (res.permanente) {
          // No se va a poder guardar (día cerrado): la pantalla del día se
          // recarga para mostrar lo que de verdad hay en la base, en vez de
          // dejar a la vista valores que no se guardaron.
          dirtyRef.current.clear()
          window.dispatchEvent(
            new CustomEvent<DetalleGuardadoImposible>(EVENTO_GUARDADO_IMPOSIBLE, {
              detail: { diaId: diaIdRef.current, msg: `No se guardó ${nombreRef.current}: ${res.error}` },
            }),
          )
          return false
        }
        fallidaRef.current = true
        if (avisar) {
          toast.error(
            `No se guardó ${nombreRef.current} (${res.error}). Queda marcado "sin guardar" y se reintenta solo cada medio minuto y antes de cerrar el día.`,
          )
        }
        return false
      }
      // Confirmado: deja de estar pendiente lo que no se volvió a tocar.
      fallidaRef.current = false
      for (const c of campos) {
        if (Object.is(latestRef.current[c], enviado[c])) dirtyRef.current.delete(c)
      }
    }
    const ok = dirtyRef.current.size === 0
    if (ok) setSinGuardar(false)
    return ok
  }, [])

  const cambiar = useCallback(<K extends keyof S>(campo: K, valor: S[K]) => {
    const next = { ...latestRef.current, [campo]: valor }
    latestRef.current = next
    dirtyRef.current.add(campo)
    setLocal(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void guardar(true), DEBOUNCE_MS)
  }, [guardar])

  // Al salir de pantalla, lo pendiente (incluido lo que está en vuelo) pasa a
  // las huérfanas.
  const entregarPendiente = useCallback((fila: string, dia: string) => {
    clearTimeout(timer.current)
    if (dirtyRef.current.size === 0) return
    entregarHuerfana(fila, {
      diaId: dia,
      nombre: nombreRef.current,
      diaFecha: diaFechaRef.current,
      campos: new Set(dirtyRef.current),
      valores: { ...latestRef.current } as Record<PropertyKey, unknown>,
      enviar: enviarRef.current as unknown as Enviar,
      previo: enVueloRef.current,
    })
  }, [])

  // La fila retoma lo que había quedado sin guardar: espera el envío que
  // estaba en curso y manda lo pendiente.
  const retomar = useCallback((fila: string, dia: string) => {
    const r = retomarHuerfana(fila, dia)
    if (!r) return
    if (r.esperar) {
      const espera: Promise<void> = r.esperar
        .catch(() => {})
        .then(() => {
          if (enVueloRef.current === espera) enVueloRef.current = null
        })
      enVueloRef.current = espera
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void guardar(true), 0)
  }, [guardar])

  useEffect(() => {
    desmontadaRef.current = false
    registrarFila(diaId, filaId, {
      nombre: () => nombreRef.current,
      guardar: () => guardar(false),
      pendiente: () => dirtyRef.current.size > 0 || enVueloRef.current !== null,
      fallida: () => fallidaRef.current && dirtyRef.current.size > 0,
      descartar: () => {
        clearTimeout(timer.current)
        dirtyRef.current.clear()
      },
    })
    retomar(filaId, diaId)
    return () => {
      desmontadaRef.current = true
      quitarFila(diaId, filaId)
      entregarPendiente(filaId, diaId)
    }
  }, [diaId, filaId, guardar, retomar, entregarPendiente])

  return { local, cambiar, saving, sinGuardar }
}
