'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Tablero from '@/components/Tablero'
import Inventory from '@/components/Inventario/Inventario'
import Ventas from '@/components/Ventas'
import Clientes from '@/components/Clientes'
import Gastos from '@/components/Gastos'
import { LayoutDashboard, Package, ShoppingCart, LogOut, Menu, X, Users, Wallet, Sparkles } from 'lucide-react'
import { getUser, signOut } from '@/lib/supabase'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'expenses'>('dashboard')
  const [cargando, setCargando] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const user = await getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserEmail(user.email || null)
      setCargando(false)
    }

    checkAuth()
  }, [router])

  // Manejar cambio de tab por URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'dashboard' || tabParam === 'inventory' || tabParam === 'sales' || tabParam === 'customers' || tabParam === 'expenses') {
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

  const handleTabChange = (tabId: 'dashboard' | 'inventory' | 'sales' | 'customers' | 'expenses') => {
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

  const tabs = [
    { id: 'dashboard' as const, label: 'Inicio', icon: LayoutDashboard },
    { id: 'inventory' as const, label: 'Inventario', icon: Package },
    { id: 'sales' as const, label: 'Ventas', icon: ShoppingCart },
    { id: 'expenses' as const, label: 'Gastos', icon: Wallet },
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
              className="w-[80%] max-w-[300px] bg-white h-full shadow-2xl p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400">Menú</h2>
                </div>
                <button onClick={() => setMenuAbierto(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-3">
                {tabs.map(tab => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { handleTabChange(tab.id); setMenuAbierto(false) }}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-sm font-bold transition-all
                                    ${isActive
                          ? 'bg-pink-50 text-pink-600 shadow-sm border border-pink-100'
                          : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-pink-500' : 'text-gray-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>

              <div className="absolute bottom-8 left-6 right-6">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-800 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-pink-500">
                      {userEmail?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-bold truncate">{getSaludo(userEmail)}</p>
                      <p className="text-[10px] text-gray-400 truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 justify-center py-3.5 text-red-500 font-bold bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Salir
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