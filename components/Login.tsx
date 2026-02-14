'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

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

        if (user) {
            router.push('/')
            router.refresh()
        }

        setCargando(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0510] relative overflow-hidden">
            {/* Glow Orbs */}
            <div className="glow-orb-1" />
            <div className="glow-orb-2" />
            <div className="glow-orb-3" />

            <div className="card-dark w-full max-w-[420px] p-10 relative z-10 login-card">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-pink-300 via-rose-300 to-violet-400 bg-clip-text text-transparent">
                        ilara
                    </h1>
                    <p className="text-xs text-pink-200/60 uppercase tracking-[0.15em] font-semibold">
                        Beauty Management
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div>
                        <label className="form-label mb-2 text-pink-100/90">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            disabled={cargando}
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="form-label mb-2 text-pink-100/90">Contraseña</label>
                        <div className="relative">
                            <input
                                type={mostrarPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={cargando}
                                autoComplete="current-password"
                                className="pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setMostrarPassword(!mostrarPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-pink-200/50 hover:text-pink-200/80 transition-colors"
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
                        disabled={cargando}
                        className="btn-primary w-full justify-center mt-2 h-[50px] text-base"
                    >
                        {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-pink-200/50">
                    Sistema de gestión de inventario y ventas
                </p>
            </div>
        </div>
    )
}
