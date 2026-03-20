# Checklist – exportaciones de datos

Marcar **OK** cuando lo pruebes en la app (staging o producción). Objetivo: asegurar que el negocio puede respaldar datos sin depender de soporte.

| # | Pantalla / acción | Resultado esperado | OK |
|---|-------------------|--------------------|-----|
| 1 | Inventario / exportar productos (si existe) | CSV con BOM UTF-8 y separador `;` abre bien en Excel ES | OK |
| 2 | Exportar datos / reporte (dashboard u otra pantalla) | JSON o CSV según UI, sin errores | OK |
| 3 | Gastos – exportar con filtros por período | Respeta fechas y formato CSV | OK |
| 4 | Ingresos / ventas – exportar CSV | Respeta filtros y formato | OK |
| 5 | Clientes – exportar (si existe) | CSV correcto | OK |

**Notas:** Si alguna fila no aplica (no hay botón en la UI), marcar **N/A** y anotar dónde está la exportación real.

**Fecha revisión:** _____20/3/26__________  
**Revisó:** _______Ilan Cueto________
