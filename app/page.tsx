'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Tablero from '@/components/Tablero'
import Inventory from '@/components/Inventario/Inventario'
import Ventas from '@/components/Ventas'
import Clientes from '@/components/Clientes'
import Gastos from '@/components/Gastos'
import Ingresos from '@/components/Ingresos'
import Link from 'next/link'
import { LayoutDashboard, Package, LogOut, Menu, X, Users, Wallet, TrendingUp, Sparkles, Store } from 'lucide-react'
import { getUser, signOut } from '@/lib/supabase'

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf4ff' }}>
        <div className="text-pink-500 font-bold text-xl animate-pulse">Cargando Ilara...</div>
      </div>
    )
  }

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf4ff', padding: 24 }}>
        <div className="text-center max-w-sm">
          <p className="text-gray-600 font-medium mb-4">{authError}</p>
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
              className="px-5 py-2.5 rounded-xl border-2 border-pink-200 text-pink-600 font-bold hover:bg-pink-50 transition-colors"
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
    <div className="min-h-screen relative text-gray-800">
      <div className="app-wrapper">

        {/* Header Desktop */}
        <header className="mb-0 pt-2 hidden md:hidden">
          {/* Kept exclusively for structure, but visual header is now integrated differently */}
        </header>

        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-72 bg-white border-r border-pink-100 h-screen sticky top-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-8 pb-4 flex flex-col items-center">
            <div className={`relative transition-transform hover:scale-105 duration-300 flex items-center justify-center ${logoError ? 'flex-col gap-2' : 'w-64 h-32 mb-2'}`}>
              {/* Logo Image or Fallback */}
              {!logoError ? (
                <img
                  src="/logo_icon.png"
                  alt="Ilara Beauty"
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-pink-100 rounded-full text-pink-500 shadow-sm">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <p className="text-[10px] text-pink-400 uppercase tracking-[0.2em] font-bold">Beauty POS</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 px-5 flex flex-col gap-2 mt-6">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 group relative overflow-hidden
                                ${isActive
                      ? 'text-pink-600 bg-gradient-to-r from-pink-50 to-white shadow-sm ring-1 ring-pink-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/80'
                    }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-pink-500 rounded-r-full shadow-[0_0_12px_rgba(236,72,153,0.4)]" />
                  )}
                  <Icon
                    className={`w-5 h-5 transition-all duration-300 ${isActive ? 'text-pink-500 scale-110 drop-shadow-sm' : 'text-gray-300 group-hover:text-gray-500'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={isActive ? 'tracking-wide' : 'tracking-normal'}>{tab.label}</span>
                </button>
              )
            })}
            <Link
              href="/catalogo"
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50/80 transition-all duration-300 group"
            >
              <Store className="w-5 h-5 text-gray-300 group-hover:text-gray-500" strokeWidth={2} />
              <span>Catálogo</span>
            </Link>
          </nav>

          <div className="p-6 mt-auto">
            <div className="bg-gradient-to-br from-pink-50 to-white border border-pink-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
              {/* Decorative Circle */}
              <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />

              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600 shadow-sm">
                  <span className="font-bold text-sm tracking-wider">
                    {userEmail?.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{getSaludo(userEmail)}</p>
                  <p className="text-[10px] text-gray-500 truncate font-mono">{userEmail}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full btn-ghost p-2 text-xs font-bold text-pink-500 hover:text-pink-700 hover:bg-pink-100 rounded-lg flex items-center justify-center gap-2 transition-all mt-btn-logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-5 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-pink-100">
          <div className="flex items-center gap-2 min-h-[32px]">
            {!logoError ? (
              <img
                src="/logo_icon.png"
                alt="Ilara Beauty"
                className="h-12 w-auto max-w-[200px] object-contain object-left"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="p-2 bg-pink-100 rounded-full text-pink-500">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
          </div>
          <button onClick={() => setMenuAbierto(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {menuAbierto && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex justify-end" onClick={() => setMenuAbierto(false)}>
            <div
              className="w-[80%] max-w-[300px] bg-white h-full shadow-2xl flex flex-col p-6 sm:p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center shrink-0 pb-4 border-b border-gray-100">
                <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400">Menú</h2>
                <button onClick={() => setMenuAbierto(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Cerrar menú">
                  <X className="w-6 h-6" />
                </button>
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
                          ? 'bg-pink-50 text-pink-600 shadow-sm border border-pink-100'
                          : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-pink-500' : 'text-gray-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                      {tab.label}
                    </button>
                  )
                })}
                <Link
                  href="/catalogo"
                  onClick={() => setMenuAbierto(false)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <Store className="w-5 h-5 shrink-0 text-gray-400" strokeWidth={2} />
                  Catálogo
                </Link>
              </nav>

              <div className="shrink-0 mt-auto pt-4 border-t border-gray-100 pb-6 sm:pb-8" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3.5 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-sm text-pink-500 shrink-0">
                      {userEmail?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{getSaludo(userEmail)}</p>
                      <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 min-h-[44px] text-red-600 font-bold bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl transition-colors touch-manipulation"
                >
                  <LogOut className="w-4 h-4 shrink-0" /> Salir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="app-content flex-1 bg-[#faf9fb]">
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-pink-50 text-pink-400">Cargando...</div>}>
      <HomeContent />
    </Suspense>
  )
}