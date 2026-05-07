'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccioná...',
  emptyMessage = 'Sin resultados',
  className,
  triggerClassName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  )

  const selectedLabel = options.find((o) => o.value === value)?.label

  function computePos(): DropdownPos | null {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return { top: rect.bottom + 4, left: rect.left, width: rect.width }
  }

  function openDropdown() {
    if (disabled) return
    const pos = computePos()
    if (!pos) return
    setDropdownPos(pos)
    setSearch('')
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [open])

  function handleInputClick() {
    if (!open) openDropdown()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    if (!open) openDropdown()
  }

  function handleSelect(val: string) {
    onValueChange(val)
    setOpen(false)
    setSearch('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
    }
  }

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) {
      setOpen(false)
      setSearch('')
    } else {
      openDropdown()
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

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
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                'hover:bg-accent hover:text-accent-foreground',
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
          ))
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
          disabled={disabled}
          readOnly={!open}
          value={open ? search : (selectedLabel ?? '')}
          placeholder={placeholder}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 bg-transparent outline-none placeholder:text-muted-foreground',
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
          className="ml-2 shrink-0 text-muted-foreground"
        >
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </button>
      </div>

      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
