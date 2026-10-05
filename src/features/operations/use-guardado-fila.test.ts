import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { useGuardadoFila, EVENTO_GUARDADO_IMPOSIBLE, type ResultadoEnvio } from './use-guardado-fila'
import { guardarPendientes, hayPendientes } from './guardados-pendientes'

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

const flushMicrotasks = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

describe('useGuardadoFila', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

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
    const eventos: string[] = []
    const escuchar = (e: Event) => eventos.push((e as CustomEvent<string>).detail)
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
    expect(eventos[0]).toContain('día ya está cerrado')
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

  it('al desmontarse con algo pendiente lo intenta guardar y, si falla, avisa', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-nav')
    act(() => result.current.cambiar('conteo', 12))
    vi.mocked(toast.error).mockClear()
    unmount()
    await flushMicrotasks()
    expect(base.envios.at(-1)!.payload).toEqual({ conteo: 12 })
    await act(async () => base.envios.at(-1)!.fallar())
    await flushMicrotasks()
    expect(vi.mocked(toast.error)).toHaveBeenCalled()
    expect(String(vi.mocked(toast.error).mock.calls.at(-1)![0])).toContain('No se guardó Empanada')
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

  it('el día siguiente puede esperar el guardado que quedó en curso al salir', async () => {
    // Módulos nuevos: el registro de guardados al salir es global y los tests
    // anteriores dejan filas desmontadas con envíos colgados.
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
    await flushMicrotasks()
    expect(terminado).toBe(false)
    await act(async () => base.envios[0]!.resolver({}))
    await act(async () => { await espera })
    expect(terminado).toBe(true)
    expect(base.db.conteo).toBe(6)
    // Sin nada en curso, no espera.
    let libre = false
    await act(async () => { await esperarGuardadosAlSalir(); libre = true })
    expect(libre).toBe(true)
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
  })
})
