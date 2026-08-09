'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Package,
  LogOut,
  Users,
  CircleDot,
  Sparkles,
  BriefcaseBusiness,
} from 'lucide-react'
import { getUser, signOut } from '@/lib/supabase'
import ThemeSwitch from '@/components/ThemeSwitch'
import type { AppTab } from '@/lib/appTabs'

const Tablero = dynamic(() => import('@/components/Tablero'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando...</span>
    </div>
  ),
})
const Inventory = dynamic(() => import('@/components/Inventario/Inventario'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando inventario...</span>
    </div>
  ),
})
const Ventas = dynamic(() => import('@/components/Ventas'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando ventas...</span>
    </div>
  ),
})
const Clientes = dynamic(() => import('@/components/Clientes'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando clientes...</span>
    </div>
  ),
})
const Gastos = dynamic(() => import('@/components/Gastos'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando gastos...</span>
    </div>
  ),
})
const Ingresos = dynamic(() => import('@/components/Ingresos'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando ingresos...</span>
    </div>
  ),
})
const NegocioHub = dynamic(() => import('@/components/NegocioHub'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[40vh] text-pink-400">
      <span className="animate-pulse">Cargando...</span>
    </div>
  ),
})

const TAB_TITLES: Record<AppTab, string> = {
  dashboard: 'Inicio',
  inventory: 'Inventario',
  sales: 'Punto de venta',
  customers: 'Clientes',
  expenses: 'Gastos',
  incomes: 'Ingresos',
  negocio: 'Negocio',
}

const VALID_TABS = new Set<AppTab>([
  'dashboard',
  'inventory',
  'sales',
  'customers',
  'expenses',
  'incomes',
  'negocio',
])

/** Tabs del dock (Ingresos/Gastos resaltan Negocio). */
const DOCK_TABS = [
  { id: 'dashboard' as const, label: 'Inicio', icon: LayoutDashboard, pos: false },
  { id: 'inventory' as const, label: 'Stock', icon: Package, pos: false },
  { id: 'sales' as const, label: 'POS', icon: CircleDot, pos: true },
  { id: 'customers' as const, label: 'Clientes', icon: Users, pos: false },
  { id: 'negocio' as const, label: 'Negocio', icon: BriefcaseBusiness, pos: false },
]

function dockHighlight(tab: AppTab): AppTab {
  if (tab === 'expenses' || tab === 'incomes') return 'negocio'
  return tab
}

function getSaludo(email: string | null): string {
  if (!email) return 'Cuenta Activa'
  const e = email.toLowerCase()
  if (e === 'ilaancueto@gmail.com') return 'Hola Ilan'
  if (e === 'marubaidal28@gmail.com') return 'Hola Mara'
  return 'Cuenta Activa'
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard')
  const [cargando, setCargando] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    const AUTH_TIMEOUT_MS = 10_000

    const checkAuth = async () => {
      setAuthError(null)
      try {
        const user = await Promise.race([
          getUser(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), AUTH_TIMEOUT_MS)
          ),
        ])

        if (!user) {
          router.push('/login')
          return
        }

        setUserEmail(user.email || null)
      } catch (e) {
        console.error('Auth check failed:', e)
        setAuthError('No se pudo verificar la sesión. Revisa tu conexión o intenta de nuevo.')
      } finally {
        setCargando(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && VALID_TABS.has(tabParam as AppTab)) {
      setActiveTab(tabParam as AppTab)
    }
  }, [searchParams])

  const handleTabChange = useCallback((tabId: AppTab) => {
    setActiveTab(tabId)
    setAccountOpen(false)
    window.history.pushState({}, '', `?tab=${tabId}`)
  }, [])

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión?')) return
    await signOut()
    router.push('/login')
    router.refresh()
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf9fb] dark:bg-gray-950 text-pink-500 dark:text-pink-400 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pink-100 dark:bg-pink-900/40 animate-pulse" />
        <div className="font-bold text-lg animate-pulse">Cargando Ilara...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf4ff] dark:bg-gray-900 p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-600 dark:text-gray-300 font-medium mb-4">{authError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => {
                setCargando(true)
                setAuthError(null)
                window.location.reload()
              }}
              className="px-5 py-2.5 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="px-5 py-2.5 rounded-xl border-2 border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400 font-bold hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-colors"
            >
              Ir a inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  const highlight = dockHighlight(activeTab)
  const pageTitle = TAB_TITLES[activeTab]

  return (
    <div className="app-shell min-h-screen text-gray-800 dark:text-gray-100">
      {/* Top bar */}
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 flex items-center">
              {!logoError ? (
                <Image
                  src="/logo_icon.png"
                  alt="Ilara Beauty"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                  sizes="40px"
                  priority
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-pink-500">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-50 truncate">
                {pageTitle}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
                Ilara Beauty POS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeSwitch />
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-pink-50 dark:bg-gray-800 border border-pink-100 dark:border-gray-700 text-pink-600 dark:text-pink-400 font-bold text-xs hover:bg-pink-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                aria-label="Cuenta"
                aria-expanded={accountOpen}
              >
                {userEmail?.substring(0, 2).toUpperCase() || '·'}
              </button>
              {accountOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Cerrar menú de cuenta"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-pink-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl shadow-pink-200/30 dark:shadow-black/40 p-3 animate-fade-in">
                    <div className="px-2 py-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                        {getSaludo(userEmail)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono mt-0.5">
                        {userEmail}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="app-main">
        <div className="app-main-inner">
          {activeTab === 'dashboard' && (
            <Tablero onNavigate={handleTabChange} />
          )}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'sales' && <Ventas />}
          {activeTab === 'expenses' && <Gastos />}
          {activeTab === 'incomes' && <Ingresos />}
          {activeTab === 'customers' && <Clientes />}
          {activeTab === 'negocio' && (
            <NegocioHub onNavigate={handleTabChange} />
          )}
        </div>
      </main>

      {/* Bottom dock */}
      <nav className="app-dock" aria-label="Navegación principal">
        <div className="app-dock-inner">
          {DOCK_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = highlight === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`app-dock-item ${tab.pos ? 'app-dock-item--pos' : ''} ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="app-dock-ico" aria-hidden>
                  <Icon
                    className={tab.pos ? 'w-6 h-6' : 'w-5 h-5'}
                    strokeWidth={isActive || tab.pos ? 2.35 : 2}
                  />
                </span>
                <span className="app-dock-lbl">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default function HomePageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-pink-50 dark:bg-gray-900 text-pink-400 dark:text-pink-500">
          Cargando...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
