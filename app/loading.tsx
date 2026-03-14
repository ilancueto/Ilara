export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    </div>
  )
}
