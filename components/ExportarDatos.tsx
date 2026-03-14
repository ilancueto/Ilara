'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getExpenses } from '@/lib/expenseService'
import { createCsvBlob, CSV_DELIMITER, escapeCsvValue } from '@/lib/csvUtils'
import { X, Database, FileJson, FileSpreadsheet } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface Props {
  mostrar: boolean
  cerrar: () => void
}

const hoy = () => new Date().toISOString().split('T')[0]
const primerDiaMes = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

function descargarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExportarDatos({ mostrar, cerrar }: Props) {
  const [productos, setProductos] = useState(true)
  const [ventas, setVentas] = useState(true)
  const [clientes, setClientes] = useState(true)
  const [gastos, setGastos] = useState(true)
  const [ventasTodo, setVentasTodo] = useState(true)
  const [gastosTodo, setGastosTodo] = useState(true)
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin] = useState(hoy())
  const [cargando, setCargando] = useState(false)

  const tieneFiltro = ventas || gastos
  const usaPeriodo = (!ventasTodo && ventas) || (!gastosTodo && gastos)

  const exportar = async (formato: 'csv' | 'json') => {
    const nada = !productos && !ventas && !clientes && !gastos
    if (nada) {
      alert('Elegí al menos un tipo de dato para exportar.')
      return
    }
    if (usaPeriodo && (!fechaInicio || !fechaFin)) {
      alert('Indicá rango de fechas para ventas o gastos.')
      return
    }
    setCargando(true)
    try {
      const ventasDesde = !ventasTodo && ventas ? `${fechaInicio}T00:00:00` : null
      const ventasHasta = !ventasTodo && ventas ? `${fechaFin}T23:59:59` : null
      const gastosDesde = !gastosTodo && gastos ? fechaInicio : undefined
      const gastosHasta = !gastosTodo && gastos ? fechaFin : undefined

      const [dataProductos, dataVentas, dataClientes, dataGastos] = await Promise.all([
        productos
          ? supabase.from('products').select('*').order('id', { ascending: true }).then(({ data }) => data ?? [])
          : Promise.resolve([]),
        ventas
          ? (() => {
              let q = supabase.from('sales').select('*').order('created_at', { ascending: false })
              if (ventasDesde && ventasHasta) {
                q = q.gte('created_at', ventasDesde).lte('created_at', ventasHasta)
              }
              return q.then(({ data }) => data ?? [])
            })()
          : Promise.resolve([]),
        clientes
          ? supabase.from('customers').select('*').order('id', { ascending: true }).then(({ data }) => data ?? [])
          : Promise.resolve([]),
        gastos ? getExpenses(gastosDesde && gastosHasta ? { dateFrom: gastosDesde, dateTo: gastosHasta } : undefined) : Promise.resolve([]),
      ])

      const prefijo = `ilara_export_${hoy()}`

      if (formato === 'json') {
        const obj = {
          exportado: new Date().toISOString(),
          productos: dataProductos,
          ventas: dataVentas,
          clientes: dataClientes,
          gastos: dataGastos,
        }
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
        descargarArchivo(blob, `${prefijo}.json`)
      } else {
        if (productos && dataProductos.length) {
          const cols = Object.keys(dataProductos[0] as object)
          const csv = [cols.join(CSV_DELIMITER), ...dataProductos.map((r) => cols.map((c) => escapeCsvValue((r as unknown as Record<string, unknown>)[c])).join(CSV_DELIMITER))].join('\n')
          descargarArchivo(createCsvBlob(csv), `${prefijo}_productos.csv`)
        }
        if (ventas && dataVentas.length) {
          const cols = Object.keys(dataVentas[0] as object)
          const csv = [cols.join(CSV_DELIMITER), ...dataVentas.map((r) => cols.map((c) => escapeCsvValue((r as unknown as Record<string, unknown>)[c])).join(CSV_DELIMITER))].join('\n')
          descargarArchivo(createCsvBlob(csv), `${prefijo}_ventas.csv`)
        }
        if (clientes && dataClientes.length) {
          const cols = Object.keys(dataClientes[0] as object)
          const csv = [cols.join(CSV_DELIMITER), ...dataClientes.map((r) => cols.map((c) => escapeCsvValue((r as unknown as Record<string, unknown>)[c])).join(CSV_DELIMITER))].join('\n')
          descargarArchivo(createCsvBlob(csv), `${prefijo}_clientes.csv`)
        }
        if (gastos && dataGastos.length) {
          const cols = Object.keys(dataGastos[0] as object)
          const csv = [cols.join(CSV_DELIMITER), ...dataGastos.map((r) => cols.map((c) => escapeCsvValue((r as unknown as Record<string, unknown>)[c])).join(CSV_DELIMITER))].join('\n')
          descargarArchivo(createCsvBlob(csv), `${prefijo}_gastos.csv`)
        }
        if ((productos && !dataProductos.length) || (ventas && !dataVentas.length) || (clientes && !dataClientes.length) || (gastos && !dataGastos.length)) {
          alert('Algunos datos seleccionados están vacíos; se descargaron solo los que tienen filas.')
        }
      }
      cerrar()
    } catch (e) {
      console.error(e)
      alert('Error al exportar. Revisá la consola.')
    } finally {
      setCargando(false)
    }
  }

  if (!mostrar) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={cerrar} aria-hidden />
      <PastelCard className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl z-50" noHover>
        <div className="flex items-center justify-between p-5 border-b border-pink-100 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-pink-500" />
            Exportar datos
          </h3>
          <button
            type="button"
            onClick={cerrar}
            className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1 min-h-0">
          <p className="text-sm text-gray-500">
            Descargá productos, ventas, clientes y gastos en CSV o JSON. Los gastos se exportan solo con tus datos.
          </p>

          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Datos a exportar</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={productos} onChange={(e) => setProductos(e.target.checked)} className="rounded border-pink-200" />
                <span className="text-sm font-medium text-gray-700">Productos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ventas} onChange={(e) => setVentas(e.target.checked)} className="rounded border-pink-200" />
                <span className="text-sm font-medium text-gray-700">Ventas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={clientes} onChange={(e) => setClientes(e.target.checked)} className="rounded border-pink-200" />
                <span className="text-sm font-medium text-gray-700">Clientes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={gastos} onChange={(e) => setGastos(e.target.checked)} className="rounded border-pink-200" />
                <span className="text-sm font-medium text-gray-700">Gastos</span>
              </label>
            </div>
          </div>

          {tieneFiltro && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Período (ventas y gastos)</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ventasPeriodo" checked={ventasTodo} onChange={() => setVentasTodo(true)} className="border-pink-200" />
                  <span className="text-sm text-gray-700">Ventas: todo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="ventasPeriodo" checked={!ventasTodo} onChange={() => setVentasTodo(false)} className="border-pink-200" />
                  <span className="text-sm text-gray-700">Por período</span>
                </label>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gastosPeriodo" checked={gastosTodo} onChange={() => setGastosTodo(true)} className="border-pink-200" />
                  <span className="text-sm text-gray-700">Gastos: todo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gastosPeriodo" checked={!gastosTodo} onChange={() => setGastosTodo(false)} className="border-pink-200" />
                  <span className="text-sm text-gray-700">Por período</span>
                </label>
              </div>
              {usaPeriodo && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Desde</label>
                    <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="form-input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Hasta</label>
                    <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="form-input w-full text-sm" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => exportar('csv')}
              disabled={cargando}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold text-sm shadow-lg shadow-pink-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {cargando ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Descargar CSV
            </button>
            <button
              type="button"
              onClick={() => exportar('json')}
              disabled={cargando}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gray-700 hover:bg-gray-800 text-white font-semibold text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {cargando ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              Descargar JSON
            </button>
          </div>
        </div>
      </PastelCard>
    </div>
  )
}
