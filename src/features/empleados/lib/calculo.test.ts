import { describe, it, expect } from 'vitest'
import { calcularLiquidacion } from './calculo'

// Empleado base: L-S (dow 1-6) 8-16, sueldo $26000, plus $200000. Modelo de Brisa.
const empleadoBase = { sueldo_diario: 26000, plus_mensual: 200000 }
const horariosLaS = [1, 2, 3, 4, 5, 6].map((dow) => ({ dow }))

describe('calcularLiquidacion', () => {
  it('mes completo sin faltas paga sueldo × días programados + plus íntegro', () => {
    // Junio 2026: 1=lun ... 30=mar. L-S = 26 días.
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [],
      fecha_desde: '2026-06-01',
      fecha_hasta: '2026-06-30',
      incluir_plus: true,
    })
    expect(r.dias_programados).toBe(26)
    expect(r.dias_trabajados).toBe(26)
    expect(r.dias_pagados).toBe(26)
    expect(r.monto_sueldo).toBe(26 * 26000)
    expect(r.monto_plus).toBe(200000)
    expect(r.monto_total).toBe(26 * 26000 + 200000)
  })

  it('una semana con 1 ausencia injustificada no paga ese día', () => {
    // Semana del 01/06/2026 (lun) al 06/06/2026 (sáb) = 6 días programados.
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [{ fecha: '2026-06-03', paga: false }],
      fecha_desde: '2026-06-01',
      fecha_hasta: '2026-06-06',
      incluir_plus: false,
    })
    expect(r.dias_programados).toBe(6)
    expect(r.dias_trabajados).toBe(5)
    expect(r.dias_pagados).toBe(5)
    expect(r.monto_sueldo).toBe(5 * 26000)
    expect(r.monto_plus).toBe(0)
  })

  it('vacaciones se pagan aunque sean día programado', () => {
    // Brisa: vacaciones 12-18/01/2026 (todos L-S, 6 días programados).
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [{ fecha_desde: '2026-01-12', fecha_hasta: '2026-01-18' }],
      ausencias: [],
      fecha_desde: '2026-01-12',
      fecha_hasta: '2026-01-18',
      incluir_plus: false,
    })
    expect(r.dias_programados).toBe(6)
    expect(r.dias_trabajados).toBe(0)
    expect(r.dias_pagados).toBe(6)
    expect(r.monto_sueldo).toBe(6 * 26000)
  })

  it('ausencia con paga=true (ej. feriado) cuenta como ausentes pagos', () => {
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [{ fecha: '2026-06-15', paga: true }], // lunes feriado
      fecha_desde: '2026-06-15',
      fecha_hasta: '2026-06-20',
      incluir_plus: false,
    })
    expect(r.dias_programados).toBe(6)
    expect(r.dias_trabajados).toBe(5)
    expect(r.dias_ausentes_pagos).toBe(1)
    expect(r.dias_pagados).toBe(6)
    expect(r.monto_sueldo).toBe(6 * 26000)
  })

  it('domingo no es día programado (no descuenta ni paga)', () => {
    // 2026-06-07 = domingo. Brisa no trabaja domingo → no descuenta.
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [],
      fecha_desde: '2026-06-07',
      fecha_hasta: '2026-06-07',
      incluir_plus: false,
    })
    expect(r.dias_programados).toBe(0)
    expect(r.dias_pagados).toBe(0)
    expect(r.monto_sueldo).toBe(0)
  })

  it('período parcial prorratea el plus', () => {
    // 15 días sobre un mes de 30 → plus a mitad.
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [],
      fecha_desde: '2026-06-01',
      fecha_hasta: '2026-06-15',
      incluir_plus: true,
    })
    // Junio tiene 30 días; 15 días → factor 0.5.
    expect(r.monto_plus).toBe(100000)
  })

  it('incluir_plus=false ignora el plus aunque el empleado lo tenga', () => {
    const r = calcularLiquidacion({
      empleado: empleadoBase,
      horarios: horariosLaS,
      vacaciones: [],
      ausencias: [],
      fecha_desde: '2026-06-01',
      fecha_hasta: '2026-06-30',
      incluir_plus: false,
    })
    expect(r.monto_plus).toBe(0)
  })
})
