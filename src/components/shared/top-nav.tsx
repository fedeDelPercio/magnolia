'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  SettingsIcon,
  BarChart2Icon,
  SearchIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type NavItem = {
  href: string
  label: string
  /** If present, this is a section with sub-items shown as inline subnav when active. */
  sub?: { href: string; label: string }[]
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Inicio' },
  {
    href: '/catalogo',
    label: 'Catálogo',
    sub: [
      { href: '/catalogo/insumos', label: 'Insumos' },
      { href: '/catalogo/productos', label: 'Productos' },
    ],
  },
  { href: '/operacion', label: 'Operación' },
  { href: '/proveedores', label: 'Proveedores' },
  { href: '/caja', label: 'Caja' },
  { href: '/alertas', label: 'Alertas' },
]

function isActive(item: NavItem, pathname: string): boolean {
  if (item.sub) {
    return item.sub.some((s) => pathname === s.href || pathname.startsWith(s.href + '/'))
  }
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleLogout() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Error al cerrar sesión')
      return
    }
    router.push('/login')
    router.refresh()
  }

  const activeItem = NAV.find((i) => isActive(i, pathname))

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="focus-ring group flex items-center gap-2.5 rounded-full"
        >
          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <span className="font-display text-lg leading-none">M</span>
          </div>
          <span className="font-display text-xl tracking-tight">Magnolia</span>
        </Link>

        {/* Nav rail — pill on darker surface */}
        <nav className="ml-4 flex items-center gap-0.5 rounded-full bg-surface px-1 py-1" aria-label="Primaria">
          {NAV.map((item) => {
            const active = isActive(item, pathname)
            return (
              <Link
                key={item.href}
                href={item.sub ? item.sub[0]!.href : item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex h-9 w-64 items-center gap-2 rounded-full border border-border/80 bg-card/50 px-3 text-sm text-muted-foreground">
            <SearchIcon className="size-4" aria-hidden />
            <span className="text-xs">Buscar...</span>
            <kbd className="ml-auto rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-metric text-muted-foreground/70">
              ⌘K
            </kbd>
          </div>

          <Link
            href="/alertas"
            aria-label="Alertas"
            className="focus-ring grid size-9 place-items-center rounded-full border border-border/80 bg-card/50 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <BellIcon className="size-4" aria-hidden />
          </Link>

          <div ref={menuRef} className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menú de usuario"
              className="focus-ring flex items-center gap-1.5 rounded-full border border-border/80 bg-card/50 py-1 pl-1 pr-2.5 transition-colors hover:bg-card"
            >
              <div className="grid size-7 place-items-center rounded-full bg-foreground text-background">
                <span className="text-xs font-medium uppercase">F</span>
              </div>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-border/80 bg-popover shadow-lg"
              >
                <Link
                  href="/reportes"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="focus-ring -mx-px flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted/60"
                >
                  <BarChart2Icon className="size-4 text-muted-foreground" aria-hidden />
                  Reportes
                </Link>
                <Link
                  href="/config"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="focus-ring -mx-px flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted/60"
                >
                  <SettingsIcon className="size-4 text-muted-foreground" aria-hidden />
                  Configuración
                </Link>
                <div className="border-t border-border/60" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="focus-ring -mx-px flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <LogOutIcon className="size-4" aria-hidden />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subnav — only when active item has children */}
      {activeItem?.sub && (
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1 px-6 pb-3" aria-label="Sub-secciones">
          {activeItem.sub.map((s) => {
            const subActive = pathname === s.href || pathname.startsWith(s.href + '/')
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={subActive ? 'page' : undefined}
                className={cn(
                  'focus-ring rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  subActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
