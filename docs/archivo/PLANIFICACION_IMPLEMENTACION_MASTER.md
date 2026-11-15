# Planificación maestra – qué implementar (para decidir SÍ / NO / AFUERA)

**Uso:** Revisá cada ítem y respondé con el **código** (ej. `A1`, `B3`) + **SÍ**, **NO** o **AFUERA**. Lo que no marques lo damos por **pendiente de decisión**.

**Leyenda de esfuerzo:** 🟢 bajo · 🟡 medio · 🔴 alto

**Última actualización:** A (A1–A6 salvo ejecutar SQL en tu proyecto) y B (B1–B4 según docs) **implementados en el repo**; las **F** quedan fuera hasta que el negocio crezca.

---

## A. Base de datos y Supabase (operación + fixes)

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **A1** | Aplicar en **producción** todas las migraciones pendientes (`catalog_badge`, `visible_in_catalog`, `image_urls`, etc.) y verificar que el panel no rompa | 🟢 |
| **A2** | Auditoría puntual de **RLS** en Supabase vs scripts del repo; documentar diferencias | 🟡 |
| **A3** | **Orden “más vendidos” en catálogo:** vista/RPC de solo lectura o política `anon` acotada para agregados de ventas (sin filtrar datos sensibles) | 🟡 |
| **A4** | Revisar **políticas del bucket `receipts`** (listado público, tamaño máx., tipos MIME) | 🟢 |
| **A5** | **Unificar estrategia de migraciones:** solo `supabase/migrations/` + README de orden, o script maestro; deprecar SQL sueltos confusos | 🟡 |
| **A6** | Parametrizar **`remotePatterns`** de imágenes (hostname Supabase) vía `NEXT_PUBLIC_*` para otros entornos | 🟢 |

---

## B. Seguridad y dependencias

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **B1** | Ejecutar **`npm audit`**, aplicar fixes seguros y documentar lo que quede con `--force` o major bumps | 🟡 |
| **B2** | Plan de actualización **Serwist / Next** si hay CVEs solo en build; suprimir o sustituir según riesgo | 🟡 |
| **B3** | Endurecer **CSP** (nonce/hash, quitar `unsafe-eval` si es posible) en staging + pruebas | 🔴 |
| **B4** | Revisión **passkeys** / Edge Function: rate limits, logs, alertas | 🟡 |

---

## C. Calidad de código y arquitectura

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **C1** | **Refactor `Catalogo.tsx`:** hooks (`useCatalogFilters`, `useCatalogPagination`, etc.) + troceo de UI | 🟡 |
| **C2** | Revisar **duplicación** POS vs catálogo (precios, descuentos) y centralizar donde duela | 🟡 |
| **C3** | **Server Actions o route handlers** para operaciones que hoy hace el cliente con anon (donde aplique) | 🔴 |
| **C4** | Convención de **nombres** (ES en UI / EN en código) documentada en `CONTRIBUTING.md` | 🟢 |
| **C5** | **Storybook** o guía de componentes UI (`PastelCard`, formularios) | 🟡 |

---

## D. Tests, CI y operación

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **D1** | **GitHub Actions:** `lint` + `test` + `build` en cada PR | 🟢 |
| **D2** | Ampliar **tests unitarios** (ventas, inventario, cupones, `catalogBadges`) | 🟡 |
| **D3** | Ampliar **E2E Playwright** (flujo venta, crear producto, gasto) | 🟡 |
| **D4** | Integrar **Sentry** (o similar) para errores de cliente | 🟢 |
| **D5** | Documentar **BCyP** y releases en README | 🟢 |

---

## E. UX, accesibilidad y performance

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **E1** | **A11y:** `aria-label` en toasts, botones icónicos, foco en modales | 🟢 |
| **E2** | **Iconos PWA** (`icon-192`, `icon-512`, apple-touch) sin 404; manifest alineado | 🟢 |
| **E3** | Optimizar **peso del logo** / assets LCP | 🟢 |
| **E4** | **Virtualización** del grid del catálogo si hay muchos ítems | 🔴 |
| **E5** | **Lazy** extra de modales pesados del catálogo | 🟢 |
| **E6** | Documentar **qué funciona offline** (Serwist) en README o `/~offline` | 🟢 |

---

## F. Features de negocio (producto)

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **F1** | **Pedidos desde catálogo:** tabla `orders` / estados, panel interno, stock reservado o validado al confirmar | 🔴 |
| **F2** | **Alertas de stock** (email, WhatsApp API o push) por umbral / min_stock | 🟡 |
| **F3** | **Roles** (vendedor / admin / solo lectura) con Supabase Auth + claims o tabla `profiles` | 🔴 |
| **F4** | **Reportes:** margen por categoría, rotación, comparativa mensual | 🟡 |
| **F5** | **Plantillas de exportación** guardadas (CSV/PDF) | 🟡 |
| **F6** | **CRM mínimo:** etiquetas en clientes, notas, historial unificado | 🟡 |
| **F7** | **Devoluciones / notas de crédito** vinculadas a ventas y stock | 🔴 |
| **F8** | **B2B:** listas de precios por cliente, pedido mínimo, catálogo restringido | 🔴 |
| **F9** | **Pagos online** (Mercado Pago / Stripe) para señas o cobro | 🔴 |
| **F10** | **Multisucursal:** ubicaciones, stock por depósito, transferencias | 🔴 |
| **F11** | **i18n** (segundo idioma) preparación + strings | 🔴 |

---

## G. Documentación y gobierno

| ID | Ítem | Esfuerzo |
|----|------|----------|
| **G1** | Enlazar **`AUDITORIA_APLICACION_COMPLETA.md`** desde README | 🟢 |
| **G2** | Mantener **`SECURITY_PENTEST.md`** actualizado tras cambios de RLS/anon | 🟢 |
| **G3** | **`.env.example`** completo con descripciones (sin secretos) | 🟢 |

---

## Cómo responder (ejemplo)

```
A1 SÍ
A3 AFUERA (por ahora)
D1 SÍ
F1 NO
F2 SÍ
...
```

Cuando respondas, armamos **sprints** (ej. sprint 1: A1, D1, E1, G1) con orden sugerido.

---

*Generado a partir de `docs/AUDITORIA_APLICACION_COMPLETA.md` y hallazgos del repo.*
