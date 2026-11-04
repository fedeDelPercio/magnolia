import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { CurrencyInput, interpretarTecleo } from './currency-input'

afterEach(cleanup)

describe('interpretarTecleo', () => {
  it('un punto seguido de 3 dígitos son miles', () => {
    expect(interpretarTecleo('15.000')).toEqual({ valor: '15000', texto: '15.000' })
    expect(interpretarTecleo('1.234.567')).toEqual({ valor: '1234567', texto: '1.234.567' })
  })

  it('reagrupa en vivo al seguir tipeando dígitos', () => {
    expect(interpretarTecleo('1234')).toEqual({ valor: '1234', texto: '1.234' })
    expect(interpretarTecleo('1.2345')).toEqual({ valor: '12345', texto: '12.345' })
  })

  it('mientras se tipea el punto, se muestra tal cual', () => {
    expect(interpretarTecleo('15.')).toEqual({ valor: '15.', texto: '15.' })
    expect(interpretarTecleo('15.0')).toEqual({ valor: '15.0', texto: '15.0' })
  })

  it('la coma es el decimal', () => {
    expect(interpretarTecleo('4.430,73')).toEqual({ valor: '4430.73', texto: '4.430,73' })
    expect(interpretarTecleo('0,5')).toEqual({ valor: '0.5', texto: '0,5' })
  })

  it('un punto con 1 o 2 decimales sigue siendo decimal', () => {
    expect(interpretarTecleo('15.5').valor).toBe('15.5')
    expect(interpretarTecleo('15.50').valor).toBe('15.50')
  })
})

function Probador({ onCambio }: { onCambio: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <CurrencyInput
      aria-label="monto"
      value={v}
      onValueChange={(raw) => {
        setV(raw)
        onCambio(raw)
      }}
    />
  )
}

describe('CurrencyInput', () => {
  it('tipear "15.000" tecla por tecla guarda 15000 (antes quedaba 15)', async () => {
    const onCambio = vi.fn()
    render(<Probador onCambio={onCambio} />)
    const input = screen.getByLabelText('monto')
    await userEvent.click(input)
    await userEvent.keyboard('15.000')
    expect(onCambio).toHaveBeenLastCalledWith('15000')
    expect(input).toHaveValue('15.000')
    await userEvent.tab()
    expect(input).toHaveValue('15.000,00')
  })

  it('tipear con coma decimal', async () => {
    const onCambio = vi.fn()
    render(<Probador onCambio={onCambio} />)
    const input = screen.getByLabelText('monto')
    await userEvent.click(input)
    await userEvent.keyboard('4430,73')
    expect(onCambio).toHaveBeenLastCalledWith('4430.73')
    await userEvent.tab()
    expect(input).toHaveValue('4.430,73')
  })

  it('sin tipear puntos agrupa solo', async () => {
    const onCambio = vi.fn()
    render(<Probador onCambio={onCambio} />)
    const input = screen.getByLabelText('monto')
    await userEvent.click(input)
    await userEvent.keyboard('125000')
    expect(onCambio).toHaveBeenLastCalledWith('125000')
    expect(input).toHaveValue('125.000')
  })
})
