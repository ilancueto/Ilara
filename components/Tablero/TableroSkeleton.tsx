/** Esqueleto con la misma jerarquía que el tablero cargado (menos CLS; el h2 puede pintar antes). */
export default function TableroSkeleton() {
    return (
        <div className="flex flex-col gap-10 pb-12 text-gray-800 dark:text-gray-100">
            {/* Misma jerarquía que el contenido cargado: menos CLS y el h2 puede pintar antes (LCP móvil). */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">¡Hola de nuevo! ✨</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">Cargando tu resumen…</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="h-11 w-[9.5rem] rounded-xl bg-pink-100/80 dark:bg-pink-900/40 animate-pulse" aria-hidden />
                    <div className="h-10 w-36 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6 items-stretch">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className="h-32 sm:min-h-[8rem] bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800 dark:to-gray-800/80 rounded-3xl border border-pink-100 dark:border-gray-600 animate-pulse"
                        aria-hidden
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                <div className="lg:col-span-2 min-h-[380px] rounded-3xl border border-pink-100 dark:border-gray-600 bg-gradient-to-br from-pink-50/50 to-white dark:from-gray-800 dark:to-gray-800/80 animate-pulse" aria-hidden />
                <div className="min-h-[280px] rounded-3xl border border-pink-100 dark:border-gray-600 bg-gradient-to-br from-pink-50/40 to-white dark:from-gray-800 dark:to-gray-800/80 animate-pulse" aria-hidden />
            </div>
        </div>
    )
}
