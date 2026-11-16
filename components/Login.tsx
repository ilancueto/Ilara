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
        <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] gap-3 p-3 sm:p-4 bg-canvas">
            {/* Lado de marca: bloques pastel (solo escritorio) */}
            <div className="hidden lg:grid grid-cols-2 grid-rows-[1fr_auto_auto] gap-3">
                <div className="col-span-2 rounded-card bg-primary-soft p-10 xl:p-14 flex flex-col justify-between">
                    <p className="text-2xl font-bold tracking-[0.2em] text-primary-ink">ILARA</p>
                    <div className="max-w-md">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4">Beauty studio · panel</p>
                        <h1 className="text-5xl xl:text-6xl font-bold leading-[1.02] tracking-tight text-primary-ink">
                            El estudio de belleza, en un solo panel.
                        </h1>
                        <p className="mt-6 text-muted text-base leading-relaxed">
                            Caja, stock, clientas y pedidos web con la misma calma con la que armás un look.
                        </p>
                    </div>
                </div>
                {[
                    ['Caja', 'Ventas y cobros del día', 'bg-tint-1'],
                    ['Stock', 'Productos y reposición', 'bg-tint-2'],
                    ['Clientas', 'Historial y contacto', 'bg-tint-3'],
                    ['Pedidos web', 'Catálogo y envíos', 'bg-tint-4'],
                ].map(([titulo, detalle, tono]) => (
                    <div key={titulo} className={`rounded-card ${tono} p-6`}>
                        <p className="text-lg font-bold text-ink">{titulo}</p>
                        <p className="text-sm text-muted mt-1">{detalle}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-center py-8 px-2 relative">
            <div className="fixed top-4 right-4 z-20">
                <ThemeSwitch />
            </div>

            <div
                id="login-form-card"
                className="login-card w-full max-w-[420px] relative z-10 animate-fade-in-scale rounded-card border border-line bg-surface px-7 pt-6 pb-7 sm:px-10 sm:pt-8 sm:pb-9"
            >
                <div className="flex flex-col items-center text-center mb-6">
                    <Image
                        src="/logo_ilara.png"
                        alt="Ilara Beauty"
                        width={160}
                        height={160}
                        className="object-contain w-[150px] h-[150px]"
                        priority
                    />
                    <h2 className="mt-2 text-2xl font-bold text-primary-ink">Hola de nuevo</h2>
                    <p className="text-sm text-muted mt-1">Entrá para ver tu negocio.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-email" className="text-sm font-bold text-ink pl-1">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            disabled={cargando}
                            autoComplete="email"
                            aria-label="Email"
                            className="w-full rounded-full border border-line bg-canvas px-5 py-3.5 text-ink placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none transition-colors duration-200 text-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className="text-sm font-bold text-ink pl-1">Contraseña</label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={mostrarPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={cargando}
                                autoComplete="current-password"
                                aria-label="Contraseña"
                                className="w-full rounded-full border border-line bg-canvas px-5 py-3.5 text-ink placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none transition-colors duration-200 text-sm pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPassword(!mostrarPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-hint hover:text-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {mostrarPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    {error && (
                        <div className="p-3.5 rounded-2xl bg-danger-soft border border-danger-line text-danger text-sm text-center" role="alert">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={cargando}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors mt-2"
                        aria-label="Iniciar sesión"
                    >
                        {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </button>
                </form>
                <p className="mt-6 text-center text-xs text-hint">
                    Inventario, caja y catálogo de Ilara · Neuquén
                </p>
            </div>
            </div>
        </div>
    )
}
