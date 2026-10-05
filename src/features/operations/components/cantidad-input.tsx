'use client'

import { useEffect, useRef, useState } from 'react'
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
  // Redondeo a 3 decimales: las sumas entre variantes en coma flotante daban
  // "0,30000000000000004" (y no se podía borrar con el patrón de 3 decimales).
  return String(Math.round(v * 1000) / 1000).replace('.', ',')
}

function aNumero(texto: string, vacioEsNull: boolean): number | null {
  // "1.500" es mil quinientos (en Argentina el punto seguido de 3 dígitos es
  // separador de miles), no 1,5. "2.5", "2,5" o "0.250" sí son decimales.
  const t = /^[1-9]\d{0,2}\.\d{3}$/.test(texto) ? texto.replace('.', '') : texto.replace(',', '.')
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
  const inputRef = useRef<HTMLInputElement>(null)

  // Teclados virtuales (Android) mandan keydown con key "Unidentified": el
  // filtro de onKeyDown no los frena. beforeinput sí trae el texto que se va
  // a insertar y se puede cancelar antes de que cambie el campo (y se pierda
  // la selección).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    function antesDeInsertar(e: InputEvent) {
      // Lo pegado se deja pasar: onChange lo limpia (espacios, tabulación de
      // una planilla) y descarta lo que no es un número.
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') return
      if (e.data && /[^\d.,]/.test(e.data)) e.preventDefault()
    }
    el.addEventListener('beforeinput', antesDeInsertar)
    return () => el.removeEventListener('beforeinput', antesDeInsertar)
  }, [])
  // Si el valor cambia desde afuera (no por lo que se tipeó acá), se refleja.
  const [valorPrevio, setValorPrevio] = useState(value)
  if (!Object.is(value, valorPrevio)) {
    setValorPrevio(value)
    if (!Object.is(aNumero(texto, vacioEsNull), value)) setTexto(aTexto(value, mostrarCero))
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      onKeyDown={(e) => {
        // Un carácter que no puede ir ("-", letras) se frena antes de que
        // cambie el texto: si no, el navegador perdía la selección y lo que se
        // tipeaba después se sumaba al final (4 seleccionado + "-5" = 45).
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !/[\d.,]/.test(e.key)) {
          e.preventDefault()
        }
        rest.onKeyDown?.(e)
      }}
      onBlur={(e) => {
        // Al salir se muestra el número como quedó: "2.500" pasa a "2500", así
        // se ve que se tomó como dos mil quinientos.
        setTexto(aTexto(value, mostrarCero))
        rest.onBlur?.(e)
      }}
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
