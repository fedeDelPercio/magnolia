'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'

type Props = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  // Valor crudo en formato "es-US": separador decimal punto, sin separadores de
  // miles ("4430.73"). Vacio = "".
  value: string
  onValueChange: (raw: string) => void
  // Maximo de decimales mostrados/aceptados. Default 2.
  decimals?: number
}

const ALLOWED_KEYS = /^[\d.,]*$/

function formatES(raw: string, decimals: number): string {
  if (raw === '' || raw === '-') return raw
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function rawWithComma(raw: string): string {
  return raw.replace('.', ',')
}

// Quita separadores de miles (.) y normaliza coma decimal a punto. Tolera
// que el user tipee tanto "4.430,73" (pegado del Excel) como "4430,73".
function normalize(input: string): string {
  const stripped = input.replace(/\s/g, '')
  // Si trae punto Y coma, asumimos punto = miles y coma = decimal
  if (stripped.includes('.') && stripped.includes(',')) {
    return stripped.replace(/\./g, '').replace(',', '.')
  }
  // Si solo trae coma, es decimal
  if (stripped.includes(',')) return stripped.replace(',', '.')
  // Solo trae punto: puede ser decimal o miles. Si tiene mas de 3 digitos
  // despues del punto o varios puntos, asumimos miles. Si es un unico punto
  // con <=2 digitos despues, asumimos decimal.
  const dots = stripped.match(/\./g)?.length ?? 0
  if (dots === 1) {
    const [, dec] = stripped.split('.')
    if ((dec?.length ?? 0) <= 2) return stripped
    return stripped.replace(/\./g, '')
  }
  return stripped.replace(/\./g, '')
}

export function CurrencyInput({
  value,
  onValueChange,
  decimals = 2,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = React.useState(false)

  const display = focused ? rawWithComma(value) : formatES(value, decimals)

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const raw = e.target.value
        if (!ALLOWED_KEYS.test(raw)) return
        onValueChange(normalize(raw))
      }}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...rest}
    />
  )
}
