import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { CantidadInput } from './cantidad-input'

function Probador({ inicial, vacioEsNull = false, mostrarCero = false, onCambio }: {
  inicial: number | null
  vacioEsNull?: boolean
  mostrarCero?: boolean
  onCambio: (v: number | null) => void
}) {
  const [v, setV] = useState<number | null>(inicial)
  return (
    <CantidadInput
      aria-label="cantidad"
      value={v}
      vacioEsNull={vacioEsNull}
      mostrarCero={mostrarCero}
      onValueChange={(n) => {
        setV(n)
        onCambio(n)
      }}
    />
  )
}

describe('CantidadInput', () => {
  it('"-5" sobre un valor seleccionado no lo cambia (antes quedaba 45)', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={4} onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    const user = userEvent.setup()
    await user.click(input)
    input.setSelectionRange(0, input.value.length)
    await user.keyboard('-')
    expect(input.value).toBe('4')
    // La selección sigue: el 5 reemplaza al 4.
    await user.keyboard('5')
    expect(input.value).toBe('5')
    expect(onCambio).toHaveBeenLastCalledWith(5)
    expect(onCambio).not.toHaveBeenCalledWith(45)
  })

  it('acepta decimales con coma o punto sin deformarlos', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={0} onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(input, '2,5')
    expect(input.value).toBe('2,5')
    expect(onCambio).toHaveBeenLastCalledWith(2.5)
    await user.clear(input)
    await user.type(input, '3.25')
    expect(onCambio).toHaveBeenLastCalledWith(3.25)
  })

  it('ignora letras y más de 3 decimales', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={0} onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(input, '1a2')
    expect(input.value).toBe('12')
    await user.type(input, ',1234')
    expect(input.value).toBe('12,123')
  })

  it('en el conteo, vacío es "no contado" (null) y 0 se muestra como 0', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={null} vacioEsNull mostrarCero onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    expect(input.value).toBe('')
    const user = userEvent.setup()
    await user.type(input, '0')
    expect(input.value).toBe('0')
    expect(onCambio).toHaveBeenLastCalledWith(0)
    await user.clear(input)
    expect(onCambio).toHaveBeenLastCalledWith(null)
  })

  it('no acepta más de 99.999', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={0} onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(input, '123456')
    expect(input.value).toBe('12345')
    expect(onCambio).not.toHaveBeenCalledWith(123456)
  })

  it('"1.500" es mil quinientos (punto de miles); "1,5", "1.5" y "0.250" son decimales', async () => {
    const onCambio = vi.fn()
    render(<Probador inicial={0} onCambio={onCambio} />)
    const input = screen.getByLabelText('cantidad') as HTMLInputElement
    const user = userEvent.setup()
    await user.type(input, '1.500')
    expect(onCambio).toHaveBeenLastCalledWith(1500)
    await user.clear(input)
    await user.type(input, '1.5')
    expect(onCambio).toHaveBeenLastCalledWith(1.5)
    await user.clear(input)
    await user.type(input, '1,500')
    expect(onCambio).toHaveBeenLastCalledWith(1.5)
    await user.clear(input)
    await user.type(input, '0.250')
    expect(onCambio).toHaveBeenLastCalledWith(0.25)
    await user.clear(input)
    await user.type(input, '12.345')
    expect(onCambio).toHaveBeenLastCalledWith(12345)
  })
})
