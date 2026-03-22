# F8 (B2B) y F9 (pagos online) – qué implican (antes de implementar)

## F8 – Catálogo / ventas B2B

**Idea de negocio:** no todos los clientes ven el mismo precio ni el mismo catálogo. Por ejemplo: mayoristas, salones, o cuentas con lista cerrada.

**En la práctica implica:**

1. **Datos:** tablas o campos tipo `customer_price_lists`, `price_list_items`, o precio por `customer_id` + `product_id`; reglas de “pedido mínimo”; quizá marcar productos **solo B2B**.
2. **Auth:** el cliente B2B tiene que **loguearse** (aunque sea cuenta simple) para ver su lista; el catálogo público anónimo seguiría siendo el “retail” o un subconjunto.
3. **App:** flujo de login en `/catalogo` o subruta `/catalogo/mayorista`, componentes que piden precio según sesión, y panel para asignar listas a clientes.
4. **Esfuerzo:** alto: toca modelo de datos, RLS, UX y soporte operativo (quién gestiona listas).

**No es solo “un filtro”:** sin diseño claro de precios y clientes, se vuelve un lío de mantenimiento.

---

## F9 – Pagos online (Mercado Pago, Stripe, etc.)

**Idea de negocio:** cobrar seña o total desde la web o el pedido por WhatsApp, con tarjeta u otros medios.

**En la práctica implica:**

1. **Proveedor:** cuenta en MP/Stripe/PayPal, keys de **test** y **producción**, webhooks para confirmar pagos.
2. **Backend:** hoy muchas apps usan **API routes** o Edge Functions para crear la preferencia de pago y **validar** el webhook con firma (nunca confiar solo en el front).
3. **Flujo:** carrito → “Pagar” → redirect o modal del proveedor → vuelta a tu sitio → marcar pedido/venta como **pagado** o **pendiente** según el webhook.
4. **Legal / fiscal:** comprobantes, IVA, nombre en resumen de tarjeta; según tu país puede haber obligaciones extra.
5. **Esfuerzo:** alto y con **mantenimiento** (cambios de API del proveedor, disputas, reembolsos).

**Resumen en criollo:** suma complejidad y costos (comisiones + desarrollo). Tiene sentido cuando el volumen de pedidos online justifica dejar de cerrar todo solo por WhatsApp y transferencia manual.

---

*Cuando quieras implementar F8 o F9, conviene una mini-spec: actores (retail vs mayorista), flujo de pago deseado y qué sistema de facturación usan hoy.*
