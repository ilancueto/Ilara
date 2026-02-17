'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signIn } from '@/lib/supabase'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'
import { passkeys, isPasskeySupported, formatPasskeyError } from '@/lib/passkeyAuth'

export default function Login() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mostrarPassword, setMostrarPassword] = useState(false)
    const [cargando, setCargando] = useState(false)
    const [cargandoPasskey, setCargandoPasskey] = useState(false)
    const [passkeyDisponible, setPasskeyDisponible] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        setPasskeyDisponible(isPasskeySupported())
    }, [])

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

        if (user) {
            router.push('/')
            router.refresh()
        }

        setCargando(false)
    }

    const handlePasskeySignIn = async () => {
        if (!email.trim()) {
            setError('Ingresá tu email para usar huella o Face ID')
            return
        }
        setError('')
        setCargandoPasskey(true)
        const { success, session, error: err } = await passkeys.signIn({ email: email.trim() })
        setCargandoPasskey(false)
        if (err) {
            setError(formatPasskeyError(err))
            return
        }
        if (success && session) {
            router.push('/')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-rose-200 via-pink-200/90 to-rose-300/90 relative overflow-hidden">
            {/* Glow Orbs */}
            <div className="glow-orb-1" />
            <div className="glow-orb-2" />
            <div className="glow-orb-3" />

            <div id="login-form-card" className="login-card-bg w-full max-w-[420px] p-10 relative z-10 login-card">
                {/* Logo/Brand */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <Image
                        src="/logo_ilara.png"
                        alt="Ilara Beauty"
                        width={180}
                        height={180}
                        className="mb-2 object-contain"
                        priority
                    />
                    <p className="login-card-paragraph text-xs uppercase tracking-[0.15em] font-semibold" style={{ color: '#ffffff' }}>
                        Beauty Management
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div>
                        <label className="form-label mb-2 text-white">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            disabled={cargando}
                            autoComplete="email"
                            aria-label="Email"
                            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        />
                    </div>

                    <div>
                        <label className="form-label mb-2 text-white">Contraseña</label>
                        <div className="relative">
                            <input
                                type={mostrarPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={cargando}
                                autoComplete="current-password"
                                className="pr-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                aria-label="Contraseña"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPassword(!mostrarPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded"
                                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {mostrarPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={cargando || cargandoPasskey}
                        className="btn-primary w-full justify-center mt-2 h-[50px] text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-900/30"
                        aria-label="Iniciar sesión"
                    >
                        {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>

                    {passkeyDisponible && (
                        <>
                            <div className="flex items-center gap-3 my-1">
                                <div className="flex-1 h-px bg-white/30" />
                                <span className="text-white/70 text-xs">o</span>
                                <div className="flex-1 h-px bg-white/30" />
                            </div>
                            <button
                                type="button"
                                onClick={handlePasskeySignIn}
                                disabled={cargando || cargandoPasskey}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/40 bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50 text-sm font-medium"
                                aria-label="Iniciar con huella o Face ID"
                            >
                                <Fingerprint size={20} />
                                {cargandoPasskey ? 'Verificando...' : 'Iniciar con huella / Face ID'}
                            </button>
                        </>
                    )}
                </form>

                <p className="login-card-paragraph mt-[34px] text-center text-xs pb-1" style={{ color: '#ffffff' }}>
                    Sistema de gestión de inventario y ventas
                </p>
            </div>
        </div>
    )
}
