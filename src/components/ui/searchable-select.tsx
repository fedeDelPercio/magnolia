'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchesAllWords } from '@/lib/text'

export type SearchableOption = { value: string; label: string }

type DropdownPos = { top: number; left: number; width: number }

type Props = {
  options: SearchableOption[]
  value: string
  onValueChange: (value: string | null) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
  onCreate?: (search: string) => void
  // Para asociar un <label htmlFor> al campo.
  id?: string
  'aria-label'?: string
}

function posicionDe(el: HTMLElement | null): DropdownPos | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { top: rect.bottom + 4, left: rect.left, width: rect.width }
}

// Campo para escribir y elegir de una lista: al tipear se filtra (por palabras,
// sin tildes) y se elige con el mouse o con flechas + Enter.
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccioná...',
  emptyMessage = 'Sin resultados',
  className,
  triggerClassName,
  disabled,
  onCreate,
  id,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activo, setActivo] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const inputId = id ?? `${listId}-input`

  const filtered = options.filter((o) => matchesAllWords(o.label, search))

  const selectedLabel = options.find((o) => o.value === value)?.label

  function openDropdown() {
    if (disabled) return
    const pos = posicionDe(containerRef.current)
    if (!pos) return
    setDropdownPos(pos)
    setSearch('')
    setActivo(0)
    setOpen(true)
  }

  function cerrar() {
    setOpen(false)
    setSearch('')
  }

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
    }
    // La lista va en un portal con position fixed: si se scrollea la página
    // (o el diálogo), se reubica para seguir pegada al campo.
    function reubicar() {
      const pos = posicionDe(containerRef.current)
      if (pos) setDropdownPos(pos)
    }
    document.addEventListener('mousedown', handlePointer)
    window.addEventListener('scroll', reubicar, true)
    window.addEventListener('resize', reubicar)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      window.removeEventListener('scroll', reubicar, true)
      window.removeEventListener('resize', reubicar)
    }
  }, [open])

  function handleInputClick() {
    if (!open) openDropdown()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!open) openDropdown()
    setSearch(e.target.value)
    setActivo(0)
  }

  function handleSelect(val: string) {
    onValueChange(val)
    cerrar()
  }

  function marcar(i: number) {
    setActivo(i)
    dropdownRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[i]?.scrollIntoView?.({ block: 'nearest' })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      // Si el selector está dentro de un diálogo, Escape tiene que cerrar solo
      // la lista, no el diálogo entero (se perdería lo cargado).
      e.stopPropagation()
      cerrar()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        openDropdown()
        return
      }
      if (filtered.length === 0) return
      const paso = e.key === 'ArrowDown' ? 1 : -1
      marcar((activo + paso + filtered.length) % filtered.length)
      return
    }
    if (e.key === 'Enter' && open) {
      // Con la lista abierta, Enter elige (y no manda el formulario de atrás).
      e.preventDefault()
      const elegida = filtered[activo] ?? filtered[0]
      if (elegida) handleSelect(elegida.value)
      return
    }
    if (e.key === 'Tab' && open) {
      cerrar()
      return
    }
    // Llegando con Tab el campo está cerrado (y de solo lectura): la primera
    // letra lo abre y arranca la búsqueda.
    if (!open && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      openDropdown()
      setSearch(e.key)
    }
  }

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) {
      cerrar()
    } else {
      openDropdown()
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const activoId = open && filtered[activo] ? `${listId}-op-${activo}` : undefined

  const dropdown = open && dropdownPos ? (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: Math.max(dropdownPos.width, 220),
        maxWidth: 320,
        zIndex: 9999,
      }}
      className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div id={listId} role="listbox" className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 && !onCreate && (
          <p className="py-3 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        )}
        {filtered.map((option, i) => (
          <button
            key={option.value}
            id={`${listId}-op-${i}`}
            type="button"
            role="option"
            aria-selected={option.value === value}
            tabIndex={-1}
            onClick={() => handleSelect(option.value)}
            onMouseEnter={() => setActivo(i)}
            className={cn(
              'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
              'hover:bg-accent hover:text-accent-foreground',
              i === activo && 'bg-accent text-accent-foreground',
              option.value === value && 'font-medium',
            )}
          >
            <CheckIcon
              className={cn(
                'mr-2 size-3.5 shrink-0',
                option.value === value ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className="truncate">{option.label}</span>
          </button>
        ))}
        {onCreate && search.trim() && (
          <button
            type="button"
            onClick={() => { onCreate(search.trim()); cerrar() }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground"
          >
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="truncate">Crear &quot;{search.trim()}&quot;</span>
          </button>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm shadow-xs',
          'focus-within:ring-1 focus-within:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName,
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activoId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          readOnly={!open}
          value={open ? search : (selectedLabel ?? '')}
          placeholder={open ? (selectedLabel ?? placeholder) : placeholder}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed',
            !open && !selectedLabel && 'text-muted-foreground',
            !open && 'cursor-pointer select-none',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={handleChevronClick}
          aria-label={open ? 'Cerrar lista' : 'Abrir lista'}
          className="ml-2 shrink-0 text-muted-foreground"
        >
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </button>
      </div>

      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
