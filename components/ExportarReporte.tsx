'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createCsvBlob, CSV_DELIMITER, escapeCsvValue, formatDateCsv, formatNumberCsv } from '@/lib/csvUtils'
import { Download, X, FileSpreadsheet } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface Props {
    mostrar: boolean
    cerrar: () => void
}

export default function ExportarReporte({ mostrar, cerrar }: Props) {
    // Default dates: Inicio de mes y hoy
    const hoy = new Date().toISOString().split('T')[0]
    const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
    const [fechaFin, setFechaFin] = useState(hoy)
    const [cargando, setCargando] = useState(false)

    const generarCSV = async () => {
        if (!fechaInicio || !fechaFin) return
        setCargando(true)

        try {
            // 1. Obtener ventas
            const { data: ventas, error: errorVentas } = await supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    sale_date,
                    customer_name,
                    payment_method,
                    total,
                    notes,
                    status
                `)
                .gte('created_at', `${fechaInicio}T00:00:00`)
                .lte('created_at', `${fechaFin}T23:59:59`)
                .order('created_at', { ascending: false })

            if (errorVentas) throw errorVentas

            if (!ventas || ventas.length === 0) {
                alert('No hay ventas en el rango seleccionado')
                setCargando(false)
                return
            }

            // 2. CSV con formato lindo (UTF-8 BOM, ; para Excel en español, fechas/números Argentina)
            const headers = ['ID Venta', 'Fecha', 'Cliente', 'Método de pago', 'Total', 'Notas', 'Estado']
            const headerRow = headers.join(CSV_DELIMITER)

            const dataRows = ventas.map(venta => {
                const fecha = formatDateCsv(venta.sale_date || venta.created_at)
                const cliente = escapeCsvValue(venta.customer_name || 'Anónimo')
                const metodo = venta.payment_method || ''
                const total = formatNumberCsv(Number(venta.total))
                const notas = escapeCsvValue(venta.notes || '')
                const estado = venta.status || ''
                return [venta.id, fecha, cliente, metodo, total, notas, estado].map(escapeCsvValue).join(CSV_DELIMITER)
            })

            const csvContent = [headerRow, ...dataRows].join('\n')
            const blob = createCsvBlob(csvContent)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `reporte_ventas_${fechaInicio}_${fechaFin}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            cerrar()

        } catch (error) {
            console.error(error)
            alert('Error al generar el reporte')
        } finally {
            setCargando(false)
        }
    }

    if (!mostrar) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={cerrar}></div>

            <PastelCard className="w-full max-w-md !p-0 z-50 shadow-2xl animate-fade-in-scale" noHover>
                <div className="bg-white px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                        Exportar Reporte
                    </h3>
                    <button
                        onClick={cerrar}
                        className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 space-y-5">
                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Fecha Inicio</label>
                        <input
                            type="date"
                            className="form-input w-full"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2 block">Fecha Fin</label>
                        <input
                            type="date"
                            className="form-input w-full"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={cerrar}
                            className="btn-ghost flex-1 justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 border-0"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={generarCSV}
                            disabled={cargando}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cargando ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Descargar CSV
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </PastelCard>
        </div>
    )
}
