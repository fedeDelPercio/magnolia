'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  XIcon,
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
  {
    href: '/empleados',
    label: 'Empleados',
    sub: [
      { href: '/empleados', label: 'Listado' },
      { href: '/empleados/vacaciones', label: 'Vacaciones' },
      { href: '/empleados/horarios', label: 'Horarios' },
      { href: '/empleados/asistencia', label: 'Asistencia' },
    ],
  },
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
  const [mobileOpen, setMobileOpen] = useState(false)
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

  // Cerrar drawer al cambiar de ruta (navegacion exitosa)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

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
    <>
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 md:px-6">
        {/* Hamburger mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="focus-ring grid size-9 shrink-0 place-items-center rounded-full border border-border/80 bg-card/50 text-muted-foreground transition-colors hover:bg-card hover:text-foreground md:hidden"
        >
          <MenuIcon className="size-4" aria-hidden />
        </button>

        {/* Brand */}
        <Link
          href="/dashboard"
          className="focus-ring group flex items-center gap-2.5 rounded-full"
        >
          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <span className="font-display text-lg leading-none">M</span>
          </div>
          <span className="font-display text-lg tracking-tight md:text-xl">MAGNOLIA FOOD</span>
        </Link>

        {/* Nav rail desktop — oculto en mobile */}
        <nav className="ml-4 hidden items-center gap-0.5 rounded-full bg-surface px-1 py-1 md:flex" aria-label="Primaria">
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
              className="focus-ring flex cursor-pointer items-center gap-1.5 rounded-full border border-border/80 bg-card/50 py-1 pl-1 pr-2.5 transition-colors hover:bg-card"
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

      {/* Subnav desktop — solo cuando el item activo tiene hijos. En mobile aparece dentro del drawer. */}
      {activeItem?.sub && (() => {
        const matches = activeItem.sub.filter(
          (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
        )
        const longestHref = matches.reduce<string>(
          (acc, s) => (s.href.length > acc.length ? s.href : acc),
          '',
        )
        return (
          <div className="mx-auto hidden w-full max-w-[1400px] items-center gap-1 px-4 pb-3 md:flex md:px-6" aria-label="Sub-secciones">
            {activeItem.sub.map((s) => {
              const subActive = s.href === longestHref
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
        )
      })()}

    </header>
      {/* Drawer mobile — sibling del header para que `fixed` no quede atrapado
          por el backdrop-filter del header (regla CSS). */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-background shadow-xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                  <span className="font-display text-lg leading-none">M</span>
                </div>
                <span className="font-display text-lg tracking-tight">MAGNOLIA</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="focus-ring grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 p-3" aria-label="Primaria móvil">
              {NAV.map((item) => {
                const active = isActive(item, pathname)
                const itemHref = item.sub ? item.sub[0]!.href : item.href
                return (
                  <div key={item.href} className="flex flex-col">
                    <Link
                      href={itemHref}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'focus-ring rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {item.label}
                    </Link>
                    {active && item.sub && (
                      <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-3">
                        {item.sub.map((s) => {
                          const subActive = pathname === s.href || pathname.startsWith(s.href + '/')
                          return (
                            <Link
                              key={s.href}
                              href={s.href}
                              className={cn(
                                'focus-ring rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                                subActive
                                  ? 'text-primary'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {s.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
            <div className="mt-auto border-t border-border/60 p-3">
              <Link
                href="/config"
                className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <SettingsIcon className="size-4 text-muted-foreground" aria-hidden />
                Configuración
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOutIcon className="size-4" aria-hidden />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
