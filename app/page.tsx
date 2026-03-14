'use client'

import { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard, Package, LogOut, Menu, X, Users, Wallet, TrendingUp, Sparkles, Store } from 'lucide-react'
import { getUser, signOut } from '@/lib/supabase'
import ThemeSwitch from '@/components/ThemeSwitch'

const Tablero = dynamic(() => import('@/components/Tablero'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando...</span></div>,
})
const Inventory = dynamic(() => import('@/components/Inventario/Inventario'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando inventario...</span></div>,
})
const Ventas = dynamic(() => import('@/components/Ventas'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando ventas...</span></div>,
})
const Clientes = dynamic(() => import('@/components/Clientes'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando clientes...</span></div>,
})
const Gastos = dynamic(() => import('@/components/Gastos'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando gastos...</span></div>,
})
const Ingresos = dynamic(() => import('@/components/Ingresos'), {
  loading: () => <div className="flex items-center justify-center min-h-[40vh] text-pink-400"><span className="animate-pulse">Cargando ingresos...</span></div>,
})
function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'expenses' | 'incomes'>('dashboard')
  const [cargando, setCargando] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Verificar autenticación al cargar (con timeout para no colgar si Supabase no responde)
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

  // Manejar cambio de tab por URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'dashboard' || tabParam === 'inventory' || tabParam === 'sales' || tabParam === 'customers' || tabParam === 'expenses' || tabParam === 'incomes') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Cerrar menú al cambiar de tab
  useEffect(() => {
    setMenuAbierto(false)
  }, [activeTab])

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión?')) return

    await signOut()
    router.push('/login')
    router.refresh()
  }

  const handleTabChange = (tabId: 'dashboard' | 'inventory' | 'sales' | 'customers' | 'expenses' | 'incomes') => {
    setActiveTab(tabId)
    window.history.pushState({}, '', `?tab=${tabId}`)
  }

  if (cargando) {
    return (
      <div className="min-h-screen relative text-gray-800 dark:text-gray-100">
        <div className="app-wrapper">
          <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-gray-900 border-r border-pink-100 dark:border-gray-800/80 h-screen sticky top-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none">
            <div className="p-8 pb-4 flex flex-col items-center">
              <div className="w-64 h-32 mb-2 rounded-2xl bg-pink-50 dark:bg-gray-800 animate-pulse" />
            </div>
            <nav className="flex-1 px-5 flex flex-col gap-2 mt-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </nav>
            <div className="p-6 mt-auto">
              <div className="h-24 rounded-2xl bg-pink-50 dark:bg-gray-800 animate-pulse" />
            </div>
          </aside>
          <main className="app-content flex-1 bg-[#faf9fb] dark:bg-gray-950 flex items-center justify-center">
            <div className="text-pink-500 dark:text-pink-400 font-bold text-xl animate-pulse">Cargando Ilara...</div>
          </main>
        </div>
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
              onClick={() => { setCargando(true); setAuthError(null); window.location.reload(); }}
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

  const tabs = [
    { id: 'dashboard' as const, label: 'Inicio', icon: LayoutDashboard },
    { id: 'inventory' as const, label: 'Inventario', icon: Package },
    // Ventas no se muestra en el menú: se accede desde Inicio con "Nueva venta"
    { id: 'expenses' as const, label: 'Gastos', icon: Wallet },
    { id: 'incomes' as const, label: 'Ingresos', icon: TrendingUp },
    { id: 'customers' as const, label: 'Clientes', icon: Users },
  ]

  const getSaludo = (email: string | null): string => {
    if (!email) return 'Cuenta Activa'
    const e = email.toLowerCase()
    if (e === 'ilaancueto@gmail.com') return 'Hola Ilan'
    if (e === 'marubaidal28@gmail.com') return 'Hola Mara'
    return 'Cuenta Activa'
  }

  return (
    <div className="min-h-screen relative text-gray-800 dark:text-gray-100">
      <div className="app-wrapper">

        {/* Header Desktop */}
        <header className="mb-0 pt-2 hidden md:hidden">
          {/* Kept exclusively for structure */}
        </header>

        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-gray-900 border-r border-pink-100 dark:border-gray-800/80 h-screen sticky top-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none">
          {/* Logo — tighter top spacing, balanced with nav */}
          <div className="shrink-0 pt-6 pb-3 px-6 flex flex-col items-center">
            <div className={`relative transition-transform hover:scale-105 duration-300 flex items-center justify-center ${logoError ? 'flex-col gap-2' : 'w-56 h-28'}`}>
              {!logoError ? (
                <Image
                  src="/logo_icon.png"
                  alt="Ilara Beauty"
                  width={256}
                  height={128}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-pink-100 dark:bg-pink-900/40 rounded-full text-pink-500 dark:text-pink-400 shadow-sm">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <p className="text-[10px] text-pink-400 dark:text-pink-500 uppercase tracking-[0.2em] font-bold">Beauty POS</p>
                </div>
              )}
            </div>
          </div>

          {/* Nav — consistent rhythm, compact items */}
          <nav className="flex-1 min-h-0 px-4 pt-4 flex flex-col gap-0.5 overflow-y-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`sidebar-nav-item w-full flex items-center gap-3 min-h-[40px] py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 group relative
                    ${isActive
                      ? 'text-pink-600 dark:text-pink-400 bg-pink-50/80 dark:bg-pink-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50/80 dark:hover:bg-gray-800/80'
                    }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-pink-500 dark:bg-pink-400 rounded-full" />
                  )}
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-all duration-200 ${isActive ? 'text-pink-500 dark:text-pink-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="truncate text-left">{tab.label}</span>
                </button>
              )
            })}
            <Link
              href="/catalogo"
              className="sidebar-nav-item w-full flex items-center gap-3 min-h-[40px] py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-all duration-200 group"
            >
              <Store className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" strokeWidth={2} />
              <span className="truncate text-left">Catálogo</span>
            </Link>
          </nav>

          {/* Footer — theme + user card, integrated spacing */}
          <div className="shrink-0 p-4 pt-5 flex flex-col gap-3 border-t border-gray-100/80 dark:border-gray-800/80">
            <div className="flex items-center justify-end">
              <ThemeSwitch />
            </div>
            <div className="bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800 dark:to-gray-800/80 border border-pink-100 dark:border-gray-700 rounded-xl p-4 relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-white/10 dark:bg-pink-500/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
                    <span className="font-bold text-xs tracking-wider">
                      {userEmail?.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{getSaludo(userEmail)}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-mono mt-0.5">{userEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 min-h-[36px] py-2 px-3 rounded-lg text-xs font-semibold text-pink-500 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 hover:bg-pink-100/80 dark:hover:bg-gray-700/80 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 bg-white/80 dark:bg-gray-900/90 backdrop-blur-md sticky top-0 z-30 border-b border-pink-100 dark:border-gray-700">
          <div className="flex items-center gap-2 min-h-[32px]">
            {!logoError ? (
              <Image
                src="/logo_icon.png"
                alt="Ilara Beauty"
                width={200}
                height={48}
                className="h-12 w-auto max-w-[200px] object-contain object-left"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-full text-pink-500 dark:text-pink-400">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeSwitch />
            <button onClick={() => setMenuAbierto(true)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {menuAbierto && (
          <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-50 flex justify-end" onClick={() => setMenuAbierto(false)}>
            <div
              className="w-[80%] max-w-[300px] bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col p-6 sm:p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center shrink-0 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400">Menú</h2>
                <div className="flex items-center gap-1">
                  <ThemeSwitch />
                  <button onClick={() => setMenuAbierto(false)} className="p-2 -mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar menú">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto min-h-0 py-4 space-y-2">
                {tabs.map(tab => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { handleTabChange(tab.id); setMenuAbierto(false) }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all
                                    ${isActive
                          ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 shadow-sm border border-pink-100 dark:border-pink-800/50'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-pink-500 dark:text-pink-400' : 'text-gray-400 dark:text-gray-500'}`} strokeWidth={isActive ? 2.5 : 2} />
                      {tab.label}
                    </button>
                  )
                })}
                <Link
                  href="/catalogo"
                  onClick={() => setMenuAbierto(false)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  <Store className="w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={2} />
                  Catálogo
                </Link>
              </nav>

              <div className="shrink-0 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 pb-6 sm:pb-8" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                <div className="bg-gray-50/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center font-bold text-sm text-pink-500 dark:text-pink-400 shrink-0">
                      {userEmail?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{getSaludo(userEmail)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 min-h-[44px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 active:bg-red-200 dark:active:bg-red-900/50 rounded-xl transition-colors touch-manipulation"
                >
                  <LogOut className="w-4 h-4 shrink-0" /> Salir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="app-content flex-1 bg-[#faf9fb] dark:bg-gray-950 min-w-0">
          {activeTab === 'dashboard' && <Tablero />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'sales' && <Ventas />}
          {activeTab === 'expenses' && <Gastos />}
          {activeTab === 'incomes' && <Ingresos />}
          {activeTab === 'customers' && <Clientes />}
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-pink-50 dark:bg-gray-900 text-pink-400 dark:text-pink-500">Cargando...</div>}>
      <HomeContent />
    </Suspense>
  )
}