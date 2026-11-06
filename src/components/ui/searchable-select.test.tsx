import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { SearchableSelect } from './searchable-select'
import { matchesAllWords } from '@/lib/text'

afterEach(cleanup)

const OPCIONES = [
  { value: '__total__', label: 'Total proveedor' },
  { value: 'harina', label: 'Harina 000' },
  { value: 'pechuga', label: 'Pechuga de pollo' },
  { value: 'cafe', label: 'Café en grano' },
]

function Probador({ onElegir }: { onElegir: (v: string | null) => void }) {
  const [v, setV] = useState('__total__')
  return (
    <form onSubmit={() => onElegir('submit')}>
      <label htmlFor="ver">Insumo</label>
      <SearchableSelect
        id="ver"
        options={OPCIONES}
        value={v}
        onValueChange={(x) => {
          if (x) setV(x)
          onElegir(x)
        }}
      />
    </form>
  )
}

const nombres = () => screen.queryAllByRole('option').map((o) => o.textContent)

describe('matchesAllWords', () => {
  it('busca por palabras en cualquier orden, sin tildes', () => {
    expect(matchesAllWords('Total proveedor', 'proveedor total')).toBe(true)
    expect(matchesAllWords('Pechuga de pollo', 'pollo pech')).toBe(true)
    expect(matchesAllWords('Café en grano', 'cafe')).toBe(true)
    expect(matchesAllWords('Harina 000', 'harina pollo')).toBe(false)
    expect(matchesAllWords('Harina 000', '')).toBe(true)
  })
})

describe('SearchableSelect', () => {
  it('muestra la opción elegida y se asocia a su label', () => {
    render(<Probador onElegir={vi.fn()} />)
    expect(screen.getByLabelText('Insumo')).toHaveValue('Total proveedor')
  })

  it('al tocarlo lista todo, con la primera arriba', async () => {
    render(<Probador onElegir={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Insumo'))
    expect(nombres()).toEqual(['Total proveedor', 'Harina 000', 'Pechuga de pollo', 'Café en grano'])
  })

  it('al escribir filtra y Enter elige la primera que queda', async () => {
    const onElegir = vi.fn()
    render(<Probador onElegir={onElegir} />)
    const campo = screen.getByLabelText('Insumo')
    await userEvent.click(campo)
    await userEvent.keyboard('pollo')
    expect(nombres()).toEqual(['Pechuga de pollo'])
    await userEvent.keyboard('{Enter}')
    expect(onElegir).toHaveBeenLastCalledWith('pechuga')
    expect(onElegir).not.toHaveBeenCalledWith('submit')
    expect(campo).toHaveValue('Pechuga de pollo')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('"proveedor total" encuentra "Total proveedor"', async () => {
    const onElegir = vi.fn()
    render(<Probador onElegir={onElegir} />)
    await userEvent.click(screen.getByLabelText('Insumo'))
    await userEvent.keyboard('proveedor total')
    expect(nombres()).toEqual(['Total proveedor'])
  })

  it('con flechas se mueve y Enter elige', async () => {
    const onElegir = vi.fn()
    render(<Probador onElegir={onElegir} />)
    await userEvent.click(screen.getByLabelText('Insumo'))
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onElegir).toHaveBeenLastCalledWith('pechuga')
  })

  it('llegando con Tab, la primera letra abre y busca', async () => {
    const onElegir = vi.fn()
    render(<Probador onElegir={onElegir} />)
    await userEvent.tab()
    await userEvent.keyboard('h')
    expect(nombres()).toEqual(['Harina 000', 'Pechuga de pollo'])
    expect(screen.getByLabelText('Insumo')).toHaveValue('h')
  })

  it('Escape cierra sin cambiar la elección', async () => {
    const onElegir = vi.fn()
    render(<Probador onElegir={onElegir} />)
    const campo = screen.getByLabelText('Insumo')
    await userEvent.click(campo)
    await userEvent.keyboard('cafe{Escape}')
    expect(onElegir).not.toHaveBeenCalled()
    expect(campo).toHaveValue('Total proveedor')
  })
})
