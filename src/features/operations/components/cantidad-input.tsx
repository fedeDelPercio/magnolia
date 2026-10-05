'use client'

import { useState } from 'react'
import { toast } from 'sonner'

// Input de cantidades de la grilla de Operación.
//
// Lleva su propio texto para no deformar lo que se está tipeando: con un
// `type="number"` controlado, "2.5" terminaba guardado como 25 (el punto se
// perdía al re-renderizar) y "-" como 0. Acá se acepta "2", "2,5" o "2.5"
// (hasta 3 decimales, como la columna en la base) y cualquier otro carácter
// se ignora.

const MAXIMO = 99999
const PATRON = /^\d*([.,]\d{0,3})?$/

type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onValueChange: (value: number | null) => void
  // Vacío = null ("no se contó") en vez de 0. Para el conteo.
  vacioEsNull?: boolean
  // Mostrar un 0 como "0" (conteo hecho) en vez de vacío.
  mostrarCero?: boolean
}

function aTexto(v: number | null, mostrarCero: boolean): string {
  if (v === null) return ''
  if (v === 0 && !mostrarCero) return ''
  return String(v).replace('.', ',')
}

function aNumero(texto: string, vacioEsNull: boolean): number | null {
  const t = texto.replace(',', '.')
  if (t === '' || t === '.') return vacioEsNull ? null : 0
  return Number(t)
}

export function CantidadInput({
  value,
  onValueChange,
  vacioEsNull = false,
  mostrarCero = false,
  ...rest
}: Props) {
  const [texto, setTexto] = useState(() => aTexto(value, mostrarCero))
  // Si el valor cambia desde afuera (no por lo que se tipeó acá), se refleja.
  const [valorPrevio, setValorPrevio] = useState(value)
  if (!Object.is(value, valorPrevio)) {
    setValorPrevio(value)
    if (!Object.is(aNumero(texto, vacioEsNull), value)) setTexto(aTexto(value, mostrarCero))
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onChange={(e) => {
        const raw = e.target.value.trim()
        if (!PATRON.test(raw)) return
        const n = aNumero(raw, vacioEsNull)
        if (n !== null && n > MAXIMO) {
          toast.error('Máximo 99.999 por celda: revisá lo que tipeaste.')
          return
        }
        setTexto(raw)
        onValueChange(n)
      }}
    />
  )
}
