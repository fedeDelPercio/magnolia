import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import {
  useGuardadoFila,
  descartarHuerfanas,
  descartarTodoLoPendiente,
  guardarTodoLoPendiente,
  hayAlgoSinGuardar,
  EVENTO_GUARDADO_IMPOSIBLE,
  type DetalleGuardadoImposible,
  type ResultadoEnvio,
} from './use-guardado-fila'
import { guardarPendientes, hayPendientes, reintentarFallidas } from './guardados-pendientes'

type S = { conteo: number | null; produccion: number }

// "Base" falsa: aplica los campos enviados y deja controlar cada respuesta
// (resolver / fallar / colgar) para reproducir los escenarios del QA.
function crearBase(inicial: S) {
  const db: S = { ...inicial }
  const envios: Array<{ payload: Partial<S>; resolver: (r: ResultadoEnvio) => void; fallar: () => void }> = []
  const enviar = vi.fn((s: S, campos: ReadonlySet<keyof S>) => {
    const payload: Partial<S> = {}
    for (const c of campos) (payload as Record<string, unknown>)[c] = s[c]
    return new Promise<ResultadoEnvio>((resolve, reject) => {
      envios.push({
        payload,
        resolver: (r) => {
          if (!r.error) Object.assign(db, payload)
          resolve(r)
        },
        fallar: () => reject(new TypeError('Failed to fetch')),
      })
    })
  })
  return { db, envios, enviar }
}

const flushMicrotasks = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })

describe('useGuardadoFila', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    // Lo que un test deja sin guardar al desmontar no se cruza con el siguiente.
    cleanup()
    descartarHuerfanas()
    vi.useRealTimers()
  })

  function montar(base: ReturnType<typeof crearBase>, diaId = 'dia-1', filaId = 'fila-1') {
    return renderHook(() =>
      useGuardadoFila<S>({ filaId, diaId, nombre: 'Empanada', inicial: { conteo: null, produccion: 10 }, enviar: base.enviar }),
    )
  }

  it('manda solo lo editado, después del debounce', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result } = montar(base)
    act(() => result.current.cambiar('conteo', 5))
    expect(base.enviar).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(base.envios[0]!.payload).toEqual({ conteo: 5 })
    await act(async () => base.envios[0]!.resolver({}))
    expect(base.db.conteo).toBe(5)
    expect(result.current.sinGuardar).toBe(false)
  })

  it('si un guardado falla mientras sale otro, al final queda lo último tipeado (no una versión vieja)', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result } = montar(base)
    act(() => result.current.cambiar('conteo', 5))
    await act(async () => { vi.advanceTimersByTime(700) }) // envío 1 (5) colgado
    act(() => result.current.cambiar('conteo', 7))
    await act(async () => { vi.advanceTimersByTime(700) }) // guardado 2 espera al 1
    expect(base.envios).toHaveLength(1)
    await act(async () => base.envios[0]!.fallar()) // el 1 falla
    await flushMicrotasks()
    // El guardado 2 manda lo último (7), no el 5 que falló.
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 7 })
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(base.db.conteo).toBe(7)
    // Cerrar el día no reenvía nada viejo.
    let fallidos: string[] = []
    await act(async () => { fallidos = await guardarPendientes('dia-1') })
    expect(fallidos).toEqual([])
    expect(base.db.conteo).toBe(7)
    expect(result.current.local.conteo).toBe(7)
  })

  it('falla, se edita otra celda, falla de nuevo, vuelve la conexión: se guardan los dos valores nuevos', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result } = montar(base)
    act(() => result.current.cambiar('conteo', 5))
    await act(async () => { vi.advanceTimersByTime(700) })
    await act(async () => base.envios[0]!.fallar())
    await flushMicrotasks()
    expect(result.current.sinGuardar).toBe(true)
    act(() => result.current.cambiar('produccion', 24))
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(base.envios[1]!.payload).toEqual({ conteo: 5, produccion: 24 })
    await act(async () => base.envios[1]!.fallar())
    await flushMicrotasks()
    expect(hayPendientes('dia-1')).toBe(true)
    // Vuelve la conexión: cerrar el día fuerza y espera el guardado.
    let fallidos: string[] = ['x']
    const cierre = act(async () => { fallidos = await guardarPendientes('dia-1') })
    await flushMicrotasks()
    expect(base.envios[2]!.payload).toEqual({ conteo: 5, produccion: 24 })
    await act(async () => base.envios[2]!.resolver({}))
    await cierre
    expect(fallidos).toEqual([])
    expect(base.db).toEqual({ conteo: 5, produccion: 24 })
    expect(result.current.sinGuardar).toBe(false)
  })

  it('cerrar el día espera un guardado que ya estaba en curso y se frena si falla', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result } = montar(base)
    act(() => result.current.cambiar('conteo', 9))
    await act(async () => { vi.advanceTimersByTime(700) }) // en curso
    let fallidos: string[] = []
    const cierre = act(async () => { fallidos = await guardarPendientes('dia-1') })
    await act(async () => base.envios[0]!.resolver({ error: 'no se pudo guardar, probá de nuevo' }))
    await flushMicrotasks()
    // El cierre esperó el guardado en curso y reintenta lo pendiente.
    expect(base.envios).toHaveLength(2)
    expect(base.envios[1]!.payload).toEqual({ conteo: 9 })
    await act(async () => base.envios[1]!.resolver({ error: 'no se pudo guardar, probá de nuevo' }))
    await cierre
    // Falló de nuevo → el día no se cierra.
    expect(fallidos).toEqual(['Empanada'])
    expect(base.db.conteo).toBeNull()
  })

  it('un error permanente (día cerrado) pide recargar la pantalla, aunque se haya seguido editando, y no frena otros días', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-cerrado')
    const eventos: DetalleGuardadoImposible[] = []
    const escuchar = (e: Event) => eventos.push((e as CustomEvent<DetalleGuardadoImposible>).detail)
    window.addEventListener(EVENTO_GUARDADO_IMPOSIBLE, escuchar)
    act(() => result.current.cambiar('conteo', 3))
    await act(async () => { vi.advanceTimersByTime(700) })
    // Mientras vuelve el rechazo, se edita otra celda.
    act(() => result.current.cambiar('produccion', 8))
    await act(async () => base.envios[0]!.resolver({ error: 'el día ya está cerrado', permanente: true }))
    await flushMicrotasks()
    window.removeEventListener(EVENTO_GUARDADO_IMPOSIBLE, escuchar)
    // La pantalla del día recibe el aviso para recargarse (no quedan valores
    // a la vista que la base no tiene).
    expect(eventos).toHaveLength(1)
    expect(eventos[0]!.msg).toContain('día ya está cerrado')
    // Lleva el día: solo la pantalla de ese día se recarga.
    expect(eventos[0]!.diaId).toBe('dia-cerrado')
    expect(hayPendientes('dia-cerrado')).toBe(false)
    unmount()
    let fallidos: string[] = ['x']
    await act(async () => { fallidos = await guardarPendientes('otro-dia') })
    expect(fallidos).toEqual([])
  })

  it('al desmontarse sale del registro del día', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { unmount } = montar(base, 'dia-x')
    unmount()
    expect(hayPendientes('dia-x')).toBe(false)
    let fallidos: string[] = ['x']
    await act(async () => { fallidos = await guardarPendientes('dia-x') })
    expect(fallidos).toEqual([])
  })

  it('al salir con algo pendiente se sigue intentando: si falla avisa (sin perderlo) y reintenta solo', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-nav')
    act(() => result.current.cambiar('conteo', 12))
    vi.mocked(toast.error).mockClear()
    unmount()
    await act(async () => { vi.advanceTimersByTime(0) })
    await flushMicrotasks()
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 12 })
    await act(async () => base.envios.at(-1)!.fallar())
    await flushMicrotasks()
    const aviso = String(vi.mocked(toast.error).mock.calls.at(-1)![0])
    expect(aviso).toContain('No se guardó Empanada')
    expect(aviso).toContain('Se sigue intentando solo')
    // A los 30 s se reintenta solo y llega.
    const antes = base.envios.length
    await act(async () => { vi.advanceTimersByTime(30000) })
    await flushMicrotasks()
    expect(base.envios.length).toBe(antes + 1)
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 12 })
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(base.db.conteo).toBe(12)
  })

  it('lo que quedó sin guardar al salir se manda apenas vuelve la conexión', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-online')
    act(() => result.current.cambiar('produccion', 30))
    unmount()
    await act(async () => { vi.advanceTimersByTime(0) })
    await act(async () => base.envios.at(-1)!.fallar())
    await flushMicrotasks()
    const antes = base.envios.length
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await flushMicrotasks()
    expect(base.envios.length).toBe(antes + 1)
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(base.db.produccion).toBe(30)
  })

  it('salir con algo "sin guardar" (Atrás del celular) y volver al día: la fila lo retoma, lo muestra y lo guarda', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const primera = montar(base, 'dia-vuelta', 'fila-v')
    act(() => primera.result.current.cambiar('conteo', 5))
    await act(async () => { vi.advanceTimersByTime(700) })
    await act(async () => base.envios[0]!.fallar())
    await flushMicrotasks()
    expect(primera.result.current.sinGuardar).toBe(true)
    primera.unmount()
    await act(async () => { vi.advanceTimersByTime(0) })
    await flushMicrotasks()
    await act(async () => base.envios.at(-1)!.fallar()) // sigue sin conexión
    await flushMicrotasks()
    // Vuelve al día: la fila arranca con lo que no se guardó.
    const segunda = montar(base, 'dia-vuelta', 'fila-v')
    expect(segunda.result.current.local.conteo).toBe(5)
    expect(segunda.result.current.sinGuardar).toBe(true)
    expect(hayPendientes('dia-vuelta')).toBe(true)
    await act(async () => { vi.advanceTimersByTime(0) })
    await flushMicrotasks()
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 5 })
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(base.db.conteo).toBe(5)
    expect(segunda.result.current.sinGuardar).toBe(false)
  })

  it('una fila que sale con un envío en curso no pisa lo que se tipea cuando vuelve a aparecer', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const primera = montar(base, 'dia-pisa', 'fila-p')
    act(() => primera.result.current.cambiar('conteo', 5))
    await act(async () => { vi.advanceTimersByTime(700) }) // envío del 5 en curso
    primera.unmount()
    // Vuelve a aparecer enseguida (se rearma la grilla) y se tipea otra cosa.
    const segunda = montar(base, 'dia-pisa', 'fila-p')
    expect(segunda.result.current.local.conteo).toBe(5)
    act(() => segunda.result.current.cambiar('conteo', 9))
    await act(async () => { vi.advanceTimersByTime(700) })
    // Espera el envío que estaba en curso.
    expect(base.envios).toHaveLength(1)
    await act(async () => base.envios[0]!.resolver({}))
    await flushMicrotasks()
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 9 })
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(base.db.conteo).toBe(9)
    const desde9 = base.envios.findIndex((e) => e.payload.conteo === 9)
    expect(base.envios.slice(desde9 + 1).some((e) => e.payload.conteo === 5)).toBe(false)
    expect(segunda.result.current.sinGuardar).toBe(false)
  })

  it('al salir, un rechazo por día cerrado avisa y no recarga otra pantalla', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-cerrado-al-salir')
    const eventos: unknown[] = []
    const escuchar = (e: Event) => eventos.push((e as CustomEvent).detail)
    window.addEventListener(EVENTO_GUARDADO_IMPOSIBLE, escuchar)
    act(() => result.current.cambiar('conteo', 3))
    vi.mocked(toast.error).mockClear()
    unmount()
    await act(async () => { vi.advanceTimersByTime(0) })
    await flushMicrotasks()
    await act(async () => base.envios.at(-1)!.resolver({ error: 'el día ya está cerrado', permanente: true }))
    await flushMicrotasks()
    window.removeEventListener(EVENTO_GUARDADO_IMPOSIBLE, escuchar)
    expect(eventos).toHaveLength(0)
    expect(String(vi.mocked(toast.error).mock.calls.at(-1)![0])).toContain('día ya está cerrado')
    // No se reintenta: no se va a poder guardar nunca.
    const antes = base.envios.length
    await act(async () => { vi.advanceTimersByTime(30000) })
    expect(base.envios.length).toBe(antes)
  })

  it('el reintento automático solo reenvía lo que falló, no lo que se está tipeando', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const a = renderHook(() =>
      useGuardadoFila<S>({ filaId: 'fa', diaId: 'dia-r', nombre: 'A', inicial: { conteo: null, produccion: 10 }, enviar: base.enviar }),
    )
    const b = renderHook(() =>
      useGuardadoFila<S>({ filaId: 'fb', diaId: 'dia-r', nombre: 'B', inicial: { conteo: null, produccion: 10 }, enviar: base.enviar }),
    )
    // A falla.
    act(() => a.result.current.cambiar('conteo', 5))
    await act(async () => { vi.advanceTimersByTime(700) })
    await act(async () => base.envios[0]!.fallar())
    await flushMicrotasks()
    // B se está tipeando (todavía en el debounce).
    act(() => b.result.current.cambiar('conteo', 1))
    const antes = base.envios.length
    await act(async () => { void reintentarFallidas('dia-r') })
    await flushMicrotasks()
    // Solo salió A; B espera su debounce (no se manda un "1" a medio tipear).
    expect(base.envios.length).toBe(antes + 1)
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 5 })
    await act(async () => base.envios.at(-1)!.resolver({}))
    await flushMicrotasks()
    expect(a.result.current.sinGuardar).toBe(false)
    a.unmount()
    b.unmount()
  })

  it('un guardado que no responde se corta por tiempo y queda pendiente', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result } = montar(base, 'dia-lento')
    act(() => result.current.cambiar('conteo', 4))
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(result.current.saving).toBe(true)
    await act(async () => { vi.advanceTimersByTime(20000) })
    await flushMicrotasks()
    expect(result.current.saving).toBe(false)
    expect(result.current.sinGuardar).toBe(true)
    expect(hayPendientes('dia-lento')).toBe(true)
  })

  it('antes de cerrar sesión se guarda lo de la pantalla y lo de filas que ya no están', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const visible = montar(base, 'dia-sesion', 'fila-visible')
    const salio = montar(base, 'dia-sesion-2', 'fila-salio')
    act(() => salio.result.current.cambiar('conteo', 4))
    salio.unmount()
    act(() => visible.result.current.cambiar('produccion', 7))
    expect(hayAlgoSinGuardar()).toBe(true)
    let fallidos: string[] = ['x']
    const cierre = act(async () => { fallidos = await guardarTodoLoPendiente() })
    await flushMicrotasks()
    // Primero sale lo de la pantalla y después lo de la fila que ya no está.
    expect(base.envios).toHaveLength(1)
    expect(base.envios[0]!.payload).toEqual({ produccion: 7 })
    await act(async () => base.envios[0]!.resolver({}))
    await flushMicrotasks()
    expect(base.envios).toHaveLength(2)
    expect(base.envios[1]!.payload).toEqual({ conteo: 4 })
    await act(async () => base.envios[1]!.resolver({}))
    await cierre
    expect(fallidos).toEqual([])
    expect(base.db).toEqual({ conteo: 4, produccion: 7 })
    expect(hayAlgoSinGuardar()).toBe(false)
  })

  it('cerrar sesión igual (sin conexión) descarta lo pendiente: no se guarda después con otra sesión', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const visible = montar(base, 'dia-sesion-3', 'fila-v3')
    act(() => visible.result.current.cambiar('produccion', 9))
    let fallidos: string[] = []
    const cierre = act(async () => { fallidos = await guardarTodoLoPendiente() })
    await flushMicrotasks()
    await act(async () => base.envios.at(-1)!.fallar())
    await cierre
    expect(fallidos).toEqual(['Empanada'])
    descartarTodoLoPendiente()
    visible.unmount()
    const antes = base.envios.length
    await act(async () => { vi.advanceTimersByTime(60000) })
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(base.envios.length).toBe(antes)
    expect(hayAlgoSinGuardar()).toBe(false)
  })

  it('el día siguiente puede esperar lo que quedó guardándose al salir', async () => {
    // Módulos nuevos: los registros de guardados al salir son globales.
    vi.resetModules()
    const hook = await import('./use-guardado-fila')
    const { esperarGuardadosAlSalir } = await import('./guardados-pendientes')
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = renderHook(() =>
      hook.useGuardadoFila<S>({ filaId: 'f', diaId: 'dia-atras', nombre: 'Quiche', inicial: { conteo: null, produccion: 10 }, enviar: base.enviar }),
    )
    act(() => result.current.cambiar('conteo', 6))
    await act(async () => { vi.advanceTimersByTime(700) }) // en curso
    unmount()
    let terminado = false
    const espera = esperarGuardadosAlSalir().then(() => { terminado = true })
    await act(async () => { vi.advanceTimersByTime(0) })
    await flushMicrotasks()
    expect(terminado).toBe(false)
    // Llega el envío que estaba en curso; lo pendiente se vuelve a mandar
    // (no se sabe si el primero llegó) y recién ahí termina.
    await act(async () => base.envios[0]!.resolver({}))
    await flushMicrotasks()
    expect(terminado).toBe(false)
    expect(base.envios).toHaveLength(2)
    await act(async () => base.envios[1]!.resolver({}))
    await act(async () => { await espera })
    expect(terminado).toBe(true)
    expect(base.db.conteo).toBe(6)
    hook.descartarHuerfanas()
  })

  it('un guardado colgado al salir no frena la pantalla nueva más de 25 s', async () => {
    vi.resetModules()
    const hook = await import('./use-guardado-fila')
    const { esperarGuardadosAlSalir } = await import('./guardados-pendientes')
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = renderHook(() =>
      hook.useGuardadoFila<S>({ filaId: 'f', diaId: 'dia-colgado', nombre: 'Quiche', inicial: { conteo: null, produccion: 10 }, enviar: base.enviar }),
    )
    act(() => result.current.cambiar('conteo', 2))
    await act(async () => { vi.advanceTimersByTime(700) }) // en curso, nunca responde
    unmount()
    let terminado = false
    const espera = esperarGuardadosAlSalir().then(() => { terminado = true })
    await act(async () => { vi.advanceTimersByTime(19000) })
    expect(terminado).toBe(false)
    await act(async () => { vi.advanceTimersByTime(6000) })
    await act(async () => { await espera })
    expect(terminado).toBe(true)
    hook.descartarHuerfanas()
  })
})
