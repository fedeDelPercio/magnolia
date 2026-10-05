import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { useGuardadoFila, type ResultadoEnvio } from './use-guardado-fila'
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
    // El cierre reintenta lo pendiente: falla de nuevo → el día no se cierra.
    if (base.envios[1]) await act(async () => base.envios[1]!.resolver({ error: 'no se pudo guardar, probá de nuevo' }))
    await cierre
    expect(fallidos).toEqual(['Empanada'])
    expect(base.db.conteo).toBeNull()
  })

  it('un error permanente (día cerrado) descarta lo pendiente y no frena otros días', async () => {
    const base = crearBase({ conteo: null, produccion: 10 })
    const { result, unmount } = montar(base, 'dia-cerrado')
    act(() => result.current.cambiar('conteo', 3))
    await act(async () => { vi.advanceTimersByTime(700) })
    await act(async () => base.envios[0]!.resolver({ error: 'el día está cerrado', permanente: true }))
    await flushMicrotasks()
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
})
