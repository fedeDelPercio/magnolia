'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ShoppingBag,
  ClipboardList,
  Truck,
  Wallet,
  Bell,
  BarChart2,
  Settings,
  LogOut,
  ChefHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
}

type NavSection = {
  section: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    section: 'General',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Catálogo',
    items: [
      { href: '/catalogo/insumos', label: 'Insumos', icon: Package },
      { href: '/catalogo/recetas', label: 'Recetas', icon: ChefHat },
      { href: '/catalogo/productos', label: 'Productos', icon: ShoppingBag },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { href: '/operacion', label: 'Operación diaria', icon: ClipboardList },
      { href: '/proveedores', label: 'Proveedores', icon: Truck },
      { href: '/caja', label: 'Caja', icon: Wallet },
    ],
  },
  {
    section: 'Análisis',
    items: [
      { href: '/alertas', label: 'Alertas', icon: Bell },
      { href: '/reportes', label: 'Reportes', icon: BarChart2 },
    ],
  },
  {
    section: 'Sistema',
    items: [
      { href: '/config', label: 'Configuración', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-200 px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Magnolia</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map(({ section, items }) => (
            <div key={section}>
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                {section}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active ? 'text-blue-600' : 'text-gray-400',
                          )}
                        />
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4 shrink-0 text-gray-400" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
