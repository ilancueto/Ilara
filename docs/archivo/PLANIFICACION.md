# Planificación – Ilara Beauty POS

Documento maestro de mejoras y funcionalidades. Marcar o indicar con qué ítems avanzar y cuáles dejar para después.

---

## 1. Clientes

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 1.1 | Email y teléfono en clientes | Agregar campos `email` y `phone` (o `whatsapp`) a la tabla `customers` y a los formularios de alta/edición. | ⬜ Pendiente |
| 1.2 | Ficha / perfil de cliente | Vista detallada de un cliente: datos, historial de compras, total gastado, última compra (expandir lo que ya hay en stats). | ⬜ Pendiente |
| 1.3 | Segmentación (etiquetas/VIP) | Etiquetas o filtros por tipo de cliente (ej. VIP, recurrente) según monto o cantidad de ventas. | ⬜ Pendiente |

---

## 2. Ventas / Punto de venta

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 2.1 | Devoluciones / anulaciones | Poder anular una venta: estado "anulada", opcional motivo; **devolver stock** a los productos. | ⬜ Pendiente |
| 2.2 | Imprimir comprobante / ticket | Botón "Imprimir" que abra la ventana de impresión del navegador o genere un PDF descargable del comprobante. | ⬜ Pendiente |
| 2.3 | Ventas a crédito (cuentas por cobrar) | Estado "pendiente de pago" en ventas; listado de cuentas por cobrar y seguimiento (marcar como cobrada). | ⬜ Pendiente |
| 2.4 | Múltiples métodos de pago por venta | Permitir dividir el total: ej. parte efectivo + parte Mercado Pago en una misma venta. | ⬜ Pendiente |

---

## 3. Inventario

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 3.1 | Alertas de stock proactivas | Notificación (toast, badge o pantalla) cuando algún producto caiga por debajo de `min_stock`. | ⬜ Pendiente |
| 3.2 | Historial de movimientos | Registro de entradas/salidas por producto (compras, ventas, ajustes manuales) para trazabilidad. | ⬜ Pendiente |
| 3.3 | Código / SKU en productos | Campo opcional en productos para búsqueda rápida en POS e inventario. | ⬜ Pendiente |
| 3.4 | Vencimientos | Campo de fecha de vencimiento en productos (opcional) y alertas cuando se acerque. | ⬜ Pendiente |

---

## 4. Reportes y análisis

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 4.1 | Margen / ganancia | Calcular (precio_venta − precio_costo) × cantidad por venta; total por período y por producto. | ⬜ Pendiente |
| 4.2 | Ingresos vs gastos | Gráfico o resumen en el mismo período (ej. mes) para ver resultado neto. | ⬜ Pendiente |
| 4.3 | Comparativas (mes anterior, año) | Comparar con mes anterior o mismo mes del año anterior; tendencias. | ⬜ Pendiente |
| 4.4 | Más formatos de exportación | Además de CSV de ventas: export de inventario, clientes o gastos (CSV/Excel/PDF). | ⬜ Pendiente |

---

## 5. Catálogo público

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 5.1 | Links compartibles | URLs como `/catalogo?categoria=labiales` o `/catalogo?producto=123` para compartir por WhatsApp. | ⬜ Pendiente |
| 5.2 | Más criterios de orden | Orden por precio, novedades, descuento (completar si falta alguno). | ⬜ Pendiente |
| 5.3 | Modo oscuro / tema | Toggle claro/oscuro en el catálogo (o en toda la app). | ⬜ Pendiente |

---

## 6. Seguridad y operación

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 6.1 | RLS en todas las tablas | Activar RLS en `customers`, `products`, `sales`, etc.; políticas por `auth.uid()` donde aplique; documentar en `docs/RLS_SUPABASE.md`. | ⬜ Pendiente |
| 6.2 | Backup / export global | Opción para exportar productos, ventas, clientes y gastos (CSV/JSON) de forma manual o documentar proceso. | ⬜ Pendiente |
| 6.3 | Roles (admin vs empleado) | Diferenciar permisos: admin hace todo; empleado solo ventas/consulta, sin borrar datos sensibles. | ⬜ Pendiente |
| 6.4 | Auditoría (quién editó) | Campos `created_by` / `updated_by` o `user_id` en tablas críticas para saber quién hizo cada cambio. | ⬜ Pendiente |

---

## 7. UX y técnico

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 7.1 | Tests (unit + E2E) | Tests unitarios para servicios (ventas, gastos, carrito) y E2E para flujo de venta o login. | ⬜ Pendiente |
| 7.2 | Iconos PWA completos | Generar `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` y actualizar `manifest.json`. | ⬜ Pendiente |
| 7.3 | PWA offline básico | Cache del catálogo o lista de productos para ver algo sin conexión. | ⬜ Pendiente |
| 7.4 | Accesibilidad (a11y) | `aria-label` en toasts y en botones/filtros del catálogo; revisar foco y lectores de pantalla. | ⬜ Pendiente |

---

## 8. Negocio / producto

| # | Ítem | Descripción breve | Estado |
|---|------|-------------------|--------|
| 8.1 | Turnos / citas | Módulo de agenda para reservar turnos (si aplica a belleza). | ⬜ Pendiente |
| 8.2 | Fidelización (puntos o descuentos) | Descuento o beneficio por cantidad de compras (ej. cada 5 compras 10 % off). | ⬜ Pendiente |
| 8.3 | Pagos online (link de pago) | Integración Mercado Pago u otro para que el cliente pague desde el catálogo o después del pedido por WhatsApp. | ⬜ Pendiente |

---

## Cómo usar este documento

- **Estado:** Podés cambiar `⬜ Pendiente` por `✅ Hecho` o `🔲 No haremos` según decidas.
- Para avanzar: decime por ejemplo *"empecemos con 1.1, 2.1 y 6.1"* y trabajamos sobre eso.
- Si querés, agregá una columna **Prioridad** (Alta/Media/Baja) o **Esfuerzo** (S/M/L) en cada sección.

Cuando me digas con qué ítems avanzar, uso este mismo plan como referencia y vamos tachando o marcando lo que vayamos haciendo.
