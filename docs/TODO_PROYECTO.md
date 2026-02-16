# TODO – Proyecto Ilara (para luz verde)

Listado de tareas acordadas. Revisá y dame luz verde para avanzar en el orden que prefieras (o indicá cambios).

---

## Resumen

| Área | Ítems | Cantidad |
|------|--------|----------|
| Clientes | 1.1, 1.2 | 2 |
| Ventas / POS | 2.2, 2.3, 2.4 | 3 |
| Inventario | 3.2 | 1 |
| Seguridad (6) | 6.1, 6.2, 6.4 | 3 |
| UX / técnico (7) | 7.1, 7.2, 7.3, 7.4 | 4 |
| **Total** | | **13** |

---

## 1. Clientes

### 1.1 Email y teléfono en clientes ✅
- [x] **DB:** Script `supabase_customers_email_phone.sql` para agregar columnas `email` y `phone` a `customers`.
- [x] **Tipos:** Tipo `Cliente` en `lib/supabase.ts` actualizado con `email` y `phone` (opcionales).
- [x] **UI – Listado:** Email y teléfono mostrados en las cards de clientes (iconos Mail/Phone).
- [x] **UI – Formulario:** Campos email y teléfono en el modal de alta/edición (opcionales).

### 1.2 Ficha / perfil de cliente ✅
- [x] **UI:** Modal “Perfil de cliente” al hacer clic en el ícono “Ver” (Eye) de cada card: datos (nombre, email, teléfono), total gastado, cantidad de ventas, última compra.
- [x] **Datos:** Stats reutilizadas; se cargan las últimas 15 ventas del cliente y se muestran en lista (fecha, total). Botón “Editar cliente” en el pie del modal.

---

## 2. Ventas / Punto de venta

### 2.2 Imprimir comprobante / ticket ✅
- [x] **Funcionalidad:** Botón “Imprimir” (o “Ver comprobante”) en el historial de ventas o en el detalle de una venta.
- [x] **Implementación:** Ventana con comprobante (Ilara Beauty, nº venta, fecha, cliente, pago, ítems, total, notas) + diálogo de impresión del navegador.
- [x] **Alcance:** Comprobante funcional; “dejarlo lindo” queda para una segunda iteración.

### 2.3 Ventas a crédito (cuentas por cobrar) ✅
- [x] **DB:** Agregar o usar campo `status` en `sales`: permitir valor `pending_payment` (o similar) además de `completed`. Si no existe `status`, agregar columna.
- [x] **POS:** Al confirmar venta, opción “Cobrar después” / “A crédito” que guarde la venta con estado pendiente de pago.
- [x] **Historial:** Filtro o vista “Cuentas por cobrar” (ventas con estado pendiente); botón “Marcar como cobrada” que cambie el estado a completado.

### 2.4 Múltiples métodos de pago por venta ✅
- [x] **DB:** Opción A: nueva tabla `sale_payments` (sale_id, payment_method, amount). Opción B: columna JSON en `sales` con array de { method, amount }. Decidir e implementar.
- [x] **POS:** En el paso de pago, permitir agregar varios “pagos” (ej. $5000 efectivo + $3000 Mercado Pago); la suma debe coincidir con el total.
- [x] **Tipos y lectura:** Tipo `Venta` con `payment_breakdown`; historial y comprobante muestran desglose; en historial y comprobante mostrar el detalle.

---

## 3. Inventario

### 3.2 Historial de movimientos ✅
- [x] **DB:** Nueva tabla `stock_movements` (o similar): product_id, type (sale | purchase | adjustment), quantity (positivo/negativo), reference_id (opcional: sale_id, etc.), notes, created_at, user_id opcional.
- [x] **Lógica:** Al registrar una venta, insertar movimientos de tipo “sale” por cada ítem; opcional: al cargar producto o ajustar stock, insertar “purchase” o “adjustment”.
- [x] **UI:** En detalle de producto, sección "Historial de movimientos" con fecha, tipo, cantidad, ref. venta con fecha, tipo, cantidad, referencia.

---

## 6. Seguridad y operación

### 6.1 RLS en todas las tablas ✅
- [x] **Supabase:** Activar RLS en `customers`, `products`, `categories`, `sales`, `sale_items`, `expenses`, `stock_movements`, `coupons`.
- [x] **Políticas:** Definir políticas por tabla: `authenticated` puede SELECT/INSERT/UPDATE/DELETE; en `expenses` restricción por `auth.uid() = user_id`. Documentado en `docs/RLS_SUPABASE.md`.
- [x] **Script SQL:** Archivo `supabase_rls_all.sql` con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` y políticas (idempotente), para ejecutar en el SQL Editor.

### 6.2 Backup / export global ✅
- [x] **Funcionalidad:** Pantalla o botón “Exportar datos” (ej. en configuración o dashboard) que permita descargar: productos, ventas, clientes, gastos en CSV (y/o JSON).
- [x] **Alcance:** Export manual por período o “todo”; documentado en README (sección Backup y exportación) y opción desde Supabase.

### 6.4 Auditoría (quién editó) ✅
- [x] **DB:** Agregar columnas opcionales `created_by`, `updated_by` (uuid referencia a auth.users) o `user_id` en tablas críticas: `sales`, `expenses`, `products`, `customers` (y las que definas).
- [x] **App:** Al crear/actualizar, enviar `user_id` del usuario logueado (desde `getUser()`).
- [x] **Uso:** Dato guardado; mostrar “editado por” en detalle de venta/gasto/producto si se desea; prioritario es tener el dato guardado.

---

## 7. UX y técnico

### 7.1 Tests (unit + E2E) ✅
- [x] **Setup:** Configurar Vitest o Jest para unit tests; Playwright (o similar) para E2E si no está.
- [x] **Unit:** Tests para servicios: `saleService`, `expenseService`, lógica de carrito (useCarrito), cálculos de totales/descuentos.
- [x] **E2E:** Al menos un flujo E2E: login → hacer una venta (o ver catálogo); opcional: flujo de gastos.

### 7.2 Iconos PWA completos ✅
- [x] **Assets:** Generar (o redimensionar desde `logo_icon.png`) `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` en `public/`.
- [x] **Manifest:** Actualizar `public/manifest.json` para apuntar a esos iconos y evitar 404.

### 7.3 PWA offline básico ✅
- [x] **Estrategia:** Cache del catálogo (lista de productos + categorías) con Workbox/next-pwa o Service Worker para que, sin conexión, se pueda ver la última versión cacheada.
- [x] **Alcance:** Lectura del catálogo offline; no es necesario escribir ventas offline en esta iteración.

### 7.4 Accesibilidad (a11y) ✅
- [x] **Toasts:** Agregar `aria-label="Cerrar"` (o equivalente) al botón de cerrar del Toast.
- [x] **Catálogo:** Revisar botones de filtros, “Agregar al carrito”, modales: labels visibles o `aria-label`; foco visible en focus.
- [x] **General:** Revisar contraste y orden de foco en pantallas principales (login, POS, inventario).

---

## Orden sugerido de implementación

1. **Clientes (1.1 → 1.2)** – Cambio chico de schema + UI.
2. **Ventas: comprobante (2.2)** – Solo UI/print, sin cambios de modelo.
3. **Ventas: crédito (2.3) y múltiples pagos (2.4)** – Schema + POS + historial.
4. **Inventario: historial (3.2)** – Nueva tabla + inserciones en venta + UI.
5. **Seguridad: RLS (6.1)** – SQL y documentación.
6. **Seguridad: backup (6.2)** – Export global o doc.
7. **Seguridad: auditoría (6.4)** – Schema + políticas + UI.
8. **UX: iconos PWA (7.2) y a11y (7.4)** – Rápidos de cerrar.
9. **UX: PWA offline (7.3) y tests (7.1)** – Más tiempo.

---

## Fuera de alcance (por ahora)

- 1.3 Segmentación clientes  
- 2.1 Devoluciones/anulaciones  
- 3.1 Alertas stock, 3.3 SKU, 3.4 Vencimientos  
- Todo el bloque 4 (reportes), 5 (catálogo), 8 (turnos, fidelización, pagos online)  
- **6.3 Roles (admin vs empleado)** – queda para más adelante

---

Cuando des luz verde (o indiques cambios en ítems/orden), avanzo sobre este TODO y vamos marcando lo hecho en `docs/PLANIFICACION.md` y en este archivo.
