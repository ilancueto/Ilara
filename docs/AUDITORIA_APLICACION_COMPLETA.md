# Auditoría completa – Ilara Beauty App

**Fecha:** marzo 2026  
**Alcance:** aplicación completa (código, docs internas, arquitectura, negocio).  
**Stack referenciado:** Next.js 16, React 19, TypeScript, Supabase, Serwist/PWA, Tailwind.

---

## 1. Resumen ejecutivo

La app es un **ERP ligero + catálogo público** bien encaminado: autenticación con Supabase, RLS documentado, separación razonable de servicios (`saleService`, `expenseService`, etc.), PWA, headers de seguridad y CSP en `next.config.ts`, y **panel interno** con pestañas y carga diferida de módulos pesados.

**Principales huecos:** cobertura de tests baja fuera de `lib/__tests__`, dependencias con hallazgos en `npm audit` (cadena build/PWA), catálogo que puede depender de lecturas `anon` para agregados (ventas), componentes muy grandes (`Catalogo`, inventario), y oportunidades claras de **negocio** (pedidos formales, alertas de stock, roles, reportes).

---

## 2. Fortalezas

| Área | Qué está bien |
|------|----------------|
| **Stack** | TypeScript estricto, App Router, tipos en `lib/supabase.ts`. |
| **Auth / rutas** | `proxy.ts` (convención Next 16) con rutas públicas acotadas; exclusión de SW y assets en `matcher`. |
| **Seguridad HTTP** | CSP + `X-Frame-Options` + `X-Content-Type-Options` + `Referrer-Policy` + `Permissions-Policy`. |
| **Supabase** | Uso de anon key en cliente; service role solo donde corresponde (p. ej. edge passkeys). |
| **UX interna** | `next/dynamic` + loading en `app/page.tsx` para Tablero, Inventario, Ventas, etc. |
| **Documentación** | README, deploy, RLS, pentest, planes de mejora (`AUDITORIA.md`, `SECURITY_PENTEST.md`, `PLAN_MEJORAS.md`). |
| **Resiliencia** | `app/error.tsx`, `global-error.tsx`, timeout en chequeo de auth en home. |
| **Negocio** | Inventario, combos, cupones, gastos/ingresos, POS, exportaciones, passkeys documentados. |

---

## 3. Seguridad y datos

1. **RLS** – Crítico que en Supabase producción coincidan los scripts (`supabase_rls_all.sql` y migraciones). Revisión periódica al añadir tablas/columnas (p. ej. `catalog_badge`).
2. **`sale_items` y orden “más vendidos”** – Si `anon` no puede leer agregados de ventas, el orden por ventas en el catálogo **no refleja la realidad** sin una vista/RPC de solo lectura (ver `docs/SECURITY_PENTEST.md`).
3. **Comprobantes** – URLs públicas en bucket `receipts`: valorar políticas de Storage (no listar; acceso por path) y si el negocio exige privacidad, URLs firmadas vía backend.
4. **`npm audit`** – Cadenas relacionadas con build (Serwist/workbox); mitigar con actualizaciones o `npm audit fix` donde no rompa.
5. **CSP** – Incluye `'unsafe-inline'` y `'unsafe-eval'` (común con varias librerías); se puede endurecer con nonce/hash en iteraciones futuras.
6. **Imágenes (`next.config`)** – Hostname de Supabase fijo en `remotePatterns`; al cambiar proyecto o usar varios buckets, parametrizar por variables de entorno.

---

## 4. Calidad de código y mantenibilidad

- **`components/Catalogo.tsx`** – Componente muy grande (estado, filtros, paginación, modales, carrito). Recomendación: extraer hooks (`useCatalogFilters`, `useCatalogPagination`) y subcomponentes (parte ya separada en `components/Catalogo/`).
- **Duplicación** – Lógica de precios/descuentos en `catalogPricing` y badges en `catalogBadges`; coherente. Revisar duplicación POS vs catálogo donde aplique.
- **Idioma** – Mezcla español en UI y nombres en inglés en código; no bloqueante; se puede homogeneizar con convención interna.
- **Migraciones SQL** – Archivos en raíz y en `supabase/migrations/`; riesgo de **orden de aplicación** en nuevos entornos. Recomendación: un flujo único documentado (solo migraciones o un script maestro ordenado).

---

## 5. UX, accesibilidad y rendimiento

- **Accesibilidad** – Algunos controles y toasts pueden mejorar `aria-*` y etiquetas (ver `AUDITORIA.md`).
- **Imágenes** – Uso de `next/image` + `remotePatterns`; conviene versiones livianas de logos/iconos para PWA y LCP.
- **Catálogo** – Muchos productos implican mucho JS en cliente; valorar lazy de modales y virtualización del grid si el volumen crece.
- **Offline** – Página `~offline` + Serwist; documentar expectativas de qué funciona sin red.

---

## 6. Tests y automatización

- **Unitarios** – Cobertura concentrada en `lib/__tests__` (pricing, expenses, config).
- **E2E** – Playwright (`e2e/`); probablemente parcial frente a flujos críticos (venta completa, inventario, gastos).
- **CI** – Recomendado: **GitHub Actions** (o similar) con `lint` + `test` + `build` en cada PR; convención interna **BCyP** (Build, Commit, Push) para releases manuales.

---

## 7. Fixes necesarios o de alto riesgo

| Prioridad | Ítem |
|-----------|------|
| **Alta** | Aplicar en Supabase la migración `catalog_badge` (y demás pendientes) en producción si aún no está desplegada. |
| **Alta** | Confirmar RLS y políticas de Storage en buckets públicos/privados según política de datos del negocio. |
| **Media** | Resolver o documentar lectura segura para **ventas agregadas** en catálogo (vista materializada, RPC o política muy acotada). |
| **Media** | Plan de actualización de dependencias tras `npm audit` (especialmente cadena PWA/build). |
| **Baja** | Iconos PWA / assets del manifest si hay 404 al instalar la PWA (ver `AUDITORIA.md`). |

---

## 8. Oportunidades de mejora (técnicas)

1. **CI/CD** – Pipeline con lint, tests y build; previews en Vercel por PR.
2. **Observabilidad** – Además de Vercel Analytics / Speed Insights: **Sentry** (o similar) para errores de cliente y de Supabase.
3. **Refactor del catálogo** – Dividir `Catalogo.tsx` en módulos + tests de orden/filtros.
4. **Server Actions / API routes** – Operaciones sensibles o agregaciones en servidor con validación, menos lógica crítica solo en cliente anónimo.
5. **Documentación de componentes** – Storybook opcional; mínimo, patrones reutilizables para `PastelCard` y formularios.
6. **Internacionalización** – Estructura preparada para otro idioma si el negocio lo requiere.

---

## 9. Features de negocio recomendadas (priorizadas)

1. **Pedidos desde el catálogo** – Además de WhatsApp: carrito → **pedido en estado pendiente** (modelo `orders`), confirmación de stock y vista en panel; métricas y menos errores manuales.
2. **Alertas de stock** – Notificación (email / WhatsApp / push) cuando `stock ≤ min_stock` o umbral global; complementa la “lista para reposición”.
3. **Roles / equipo** – Vendedor vs administrador (ventas vs inventario y finanzas).
4. **Reportes avanzados** – Margen por categoría, rotación, comparativa mensual; **plantillas de exportación** guardadas.
5. **CRM mínimo** – Historial por cliente, etiquetas (“VIP”), fechas relevantes para campañas.
6. **Devoluciones y notas de crédito** – Ajuste de stock y cuentas sin editar ventas de forma ambigua.
7. **Catálogo B2B** – Listas de precios por cliente, pedido mínimo, catálogo restringido.
8. **Pagos online** – Integración (Mercado Pago, Stripe, etc.) para señas o cobros según modelo comercial.
9. **Multisucursal** – Si aplica: ubicaciones, stock por depósito, transferencias.

---

## 10. Documentos relacionados en el repo

- `AUDITORIA.md` – Auditoría previa (PWA, middleware, error boundaries).
- `docs/SECURITY_PENTEST.md` – Dependencias, RLS, XSS comprobantes.
- `docs/PLAN_MEJORAS.md` – Mejoras técnicas y checklist.
- `docs/RLS_SUPABASE.md` – Políticas Supabase.

---

## 11. Conclusión

La base es **sólida para un negocio chico–mediano**. El mayor salto de valor viene de **formalizar pedidos y alertas operativas**, sumar **roles y reportes**, y reforzar **tests + CI**, reduciendo deuda en componentes grandes y en dependencias.

*Este archivo puede actualizarse en futuras auditorías (fecha y versión en cabecera).*
