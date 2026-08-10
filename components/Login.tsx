'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signIn } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import ThemeSwitch from '@/components/ThemeSwitch'

function goHome(router: ReturnType<typeof useRouter>) {
    router.push('/')
    router.refresh()
}

/** Login solo por email/contraseña (Etapa 0: passkeys contenidas en UI + Edge Function). */
export default function Login() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mostrarPassword, setMostrarPassword] = useState(false)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setCargando(true)

        const { user, error: authError } = await signIn(email, password)

        if (authError) {
            setError(authError === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos'
                : authError)
            setCargando(false)
            return
        }

        if (!user) {
            setCargando(false)
            return
        }

        goHome(router)
        setCargando(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center py-6 px-4 bg-gradient-to-br from-rose-200/90 via-pink-150/95 to-rose-300/90 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-30%,rgba(251,207,232,0.4),transparent_50%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(236,72,153,0.1),transparent)] pointer-events-none z-0" aria-hidden />
            <div className="glow-orb-1 z-0" aria-hidden />
            <div className="glow-orb-2 z-0" aria-hidden />
            <div className="glow-orb-3 z-0" aria-hidden />

            <div className="fixed top-4 right-4 z-20">
                <ThemeSwitch />
            </div>

            <div
                id="login-form-card"
                className="login-card w-full max-w-[400px] relative z-10 animate-fade-in-scale rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] px-8 pt-4 pb-6 sm:px-10 sm:pt-5 sm:pb-7"
            >
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="relative">
                        <Image
                            src="/logo_ilara.png"
                            alt="Ilara Beauty"
                            width={255}
                            height={255}
                            className="object-contain w-[255px] h-[255px] drop-shadow-lg"
                            priority
                        />
                    </div>
                    <p className="mt-1 text-[13px] font-semibold tracking-[0.2em] uppercase text-gray-900 dark:text-pink-200/90">
                        Beauty Management
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            disabled={cargando}
                            autoComplete="email"
                            aria-label="Email"
                            className="w-full rounded-xl border border-gray-100 dark:border-gray-600/70 bg-gray-50/80 dark:bg-gray-700/40 px-4 py-3.5 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/25 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.12)] dark:focus:shadow-[0_0_0_3px_rgba(236,72,153,0.2)] focus:outline-none transition-all duration-200 text-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
                        <div className="relative">
                            <input
                                type={mostrarPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={cargando}
                                autoComplete="current-password"
                                aria-label="Contraseña"
                                className="w-full rounded-xl border border-gray-100 dark:border-gray-600/70 bg-gray-50/80 dark:bg-gray-700/40 pl-4 pr-12 py-3.5 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/25 focus:shadow-[0_0_0_3px_rgba(236,72,153,0.12)] dark:focus:shadow-[0_0_0_3px_rgba(236,72,153,0.2)] focus:outline-none transition-all duration-200 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPassword(!mostrarPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/50"
                                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {mostrarPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm text-center">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={cargando}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold text-base shadow-lg shadow-pink-300/30 dark:shadow-pink-900/25 hover:from-pink-600 hover:to-rose-600 hover:shadow-xl hover:shadow-pink-400/50 dark:hover:shadow-pink-500/40 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 disabled:opacity-60 transition-all duration-300 ease-out mt-1"
                        aria-label="Iniciar sesión"
                    >
                        {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
                <p className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400">
                    Sistema de gestión de inventario y ventas
                </p>
            </div>
        </div>
    )
}
