'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signIn } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import ThemeSwitch from '@/components/ThemeSwitch'
import { trackLoginFailure, trackEvent, ObservabilityEvent } from '@/lib/observability'

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
            // Sin email/password en telemetría (OBS-01).
            trackLoginFailure(
                authError === 'Invalid login credentials' ? 'invalid_credentials' : 'auth_error'
            )
            setError(authError === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos'
                : authError)
            setCargando(false)
            return
        }

        if (!user) {
            trackLoginFailure('no_user')
            setCargando(false)
            return
        }

        trackEvent({
            event: ObservabilityEvent.LOGIN_SUCCESS,
            level: 'info',
            message: 'Login ok',
        })
        goHome(router)
        setCargando(false)
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAF8F5] dark:bg-[#0F0E12] relative overflow-hidden">
            <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(217,119,134,0.18),transparent_55%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(197,168,128,0.16),transparent_50%)]" aria-hidden />
                <p className="relative font-serif text-3xl tracking-[0.22em] text-[#1A181E] dark:text-zinc-50">ILARA</p>
                <div className="relative max-w-md">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#A98C64] mb-4">Studio &amp; beauty lab</p>
                    <h1 className="font-serif text-5xl xl:text-6xl font-medium leading-[0.95] tracking-tight text-[#1A181E] dark:text-zinc-50">
                        El estudio de belleza, en un solo panel.
                    </h1>
                    <p className="mt-6 text-[#635F69] dark:text-zinc-400 text-base leading-relaxed">
                        Caja, stock, clientas y pedidos web con la misma calma con la que armás un look.
                    </p>
                </div>
                <p className="relative text-sm text-[#95909D]">Neuquén · Argentina</p>
            </div>

            <div className="flex items-center justify-center py-10 px-4 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(217,119,134,0.12),transparent_55%)] pointer-events-none" aria-hidden />

            <div className="fixed top-4 right-4 z-20">
                <ThemeSwitch />
            </div>

            <div
                id="login-form-card"
                className="login-card w-full max-w-[400px] relative z-10 animate-fade-in-scale rounded-3xl border border-[#EDE8E1] dark:border-white/10 bg-white/92 dark:bg-[#1B1A22]/92 backdrop-blur-2xl shadow-[0_24px_48px_-8px_rgba(26,24,30,0.12)] px-8 pt-4 pb-6 sm:px-10 sm:pt-5 sm:pb-7"
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
                    <p className="mt-1 text-[13px] font-semibold tracking-[0.2em] uppercase text-[#A98C64]">
                        Beauty studio
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
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-[#CF6B7F] to-[#B85064] text-white font-semibold text-base shadow-lg shadow-[#D97786]/25 hover:brightness-105 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D97786] focus-visible:ring-offset-2 disabled:opacity-60 transition-all duration-300 ease-out mt-1"
                        aria-label="Iniciar sesión"
                    >
                        {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
                <p className="mt-5 text-center text-xs text-[#95909D]">
                    Inventario, caja y catálogo de Ilara
                </p>
            </div>
            </div>
        </div>
    )
}
