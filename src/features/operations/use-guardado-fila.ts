'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { quitarFila, registrarFila } from './guardados-pendientes'

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

export type ResultadoEnvio = {
  error?: string
  // No se va a poder guardar nunca (por ejemplo, el día ya está cerrado): se
  // descarta en vez de reintentar.
  permanente?: boolean
}

type Opciones<S> = {
  filaId: string
  diaId: string
  nombre: string
  inicial: S
  enviar: (estado: S, campos: ReadonlySet<keyof S>) => Promise<ResultadoEnvio>
}

const DEBOUNCE_MS = 700

export function useGuardadoFila<S extends object>({ filaId, diaId, nombre, inicial, enviar }: Opciones<S>) {
  const [local, setLocal] = useState<S>(inicial)
  const [saving, setSaving] = useState(false)
  const [sinGuardar, setSinGuardar] = useState(false)

  const latestRef = useRef<S>(inicial)
  const dirtyRef = useRef<Set<keyof S>>(new Set())
  const enVueloRef = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enviarRef = useRef(enviar)
  const nombreRef = useRef(nombre)
  useEffect(() => {
    enviarRef.current = enviar
    nombreRef.current = nombre
  })

  const guardar = useCallback(async (avisar: boolean): Promise<boolean> => {
    clearTimeout(timer.current)
    // Hasta 3 vueltas: si mientras se guardaba se tipeó algo más, se manda eso.
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      while (enVueloRef.current) await enVueloRef.current
      if (dirtyRef.current.size === 0) {
        setSinGuardar(false)
        return true
      }
      const campos = new Set(dirtyRef.current)
      const enviado = { ...latestRef.current }
      let res: ResultadoEnvio = {}
      setSaving(true)
      const envio = (async () => {
        try {
          res = await enviarRef.current(enviado, campos)
        } catch {
          res = { error: 'sin conexión' }
        }
      })()
      enVueloRef.current = envio
      await envio
      enVueloRef.current = null
      setSaving(false)

      if (res.error) {
        setSinGuardar(true)
        if (res.permanente) {
          dirtyRef.current.clear()
          toast.error(`No se guardó ${nombreRef.current}: ${res.error}`)
          return false
        }
        if (avisar) {
          toast.error(
            `No se guardó ${nombreRef.current} (${res.error}). Queda marcado "sin guardar" y se vuelve a intentar al volver la conexión, al seguir editando y antes de cerrar el día.`,
          )
        }
        return false
      }
      // Confirmado: deja de estar pendiente lo que no se volvió a tocar.
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

  useEffect(() => {
    registrarFila(diaId, filaId, {
      nombre: () => nombreRef.current,
      guardar: () => guardar(false),
      pendiente: () => dirtyRef.current.size > 0 || enVueloRef.current !== null,
    })
    const dirty = dirtyRef.current
    return () => {
      quitarFila(diaId, filaId)
      // Al salir de la pantalla, lo que quedaba se intenta mandar igual.
      if (dirty.size > 0) void guardar(false)
    }
  }, [diaId, filaId, guardar])

  return { local, cambiar, saving, sinGuardar }
}
