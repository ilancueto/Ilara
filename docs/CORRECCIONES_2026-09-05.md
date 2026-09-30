# Correcciones del catálogo y panel — 5 de septiembre de 2026

> Informe histórico de la fecha indicada. Consultar [ESTADO.md](../ESTADO.md) para el estado actual verificado; no inferir la versión publicada a partir de este informe.

Cambios derivados de `REVISION_PRODUCTO_2026-09-05.md`. La migración y la aplicación están publicadas en producción el 5 de septiembre de 2026. Los fallos de DNS de los primeros intentos se resolvieron al recuperar la conexión.

## Publicación confirmada

- Dominio: https://ilara.com.ar. Vercel confirmó que apunta a `dpl_3v5WJ1XsmPZ6prrAmPDJJ662uTPY`, estado `READY`, entorno `production`.
- URL de versión: https://ilara-7z9vmr60d-ilara.vercel.app. Build remoto aprobado, 72 páginas, compilación y TypeScript sin errores.
- Se construyó con `--prod --skip-domain`, se comprobaron catálogo, login y seguimiento mediante el acceso autenticado de Vercel, y se activó con `vercel promote`.
- El smoke público terminó con **16/16 verificaciones aprobadas**. La primera ejecución sobre la URL protegida no pudo inspeccionar la aplicación por las redirecciones de autenticación; la prueba válida del dominio público sí pasó completa.
- Checkout móvil en producción: ficha `/catalogo/p/86` → agregar artículo → bolsa → datos del pedido. Formulario y provincias cargados; sin errores de JavaScript. Evidencia: `review-2026-09-05/checkout-mobile-production.png`.
- Seguimiento: `Referrer-Policy: no-referrer` y respuesta privada sin caché.
- Consulta de logs de errores de esta versión, últimos 15 minutos: Vercel no devolvió registros. Es una comprobación puntual, no monitoreo continuo.
- La prueba SQL de ejecución como `anon` confirmó `anonymous_call_denied` para la RPC de combos, dentro de una transacción revertida.
- No se completó un pedido, cobro o envío de email de prueba. Sigue pendiente la prueba integral con proveedores de prueba y el panel autenticado.

## Preparación e intentos anteriores

- El proyecto remoto `qbbnvdmadgomfmrsfxlo` estaba `ACTIVE_HEALTHY`. El dry-run identificó únicamente `20260905162516_atomic_combo_save.sql`; se aplicó con éxito mediante `supabase db push --linked --yes`.
- Se verificó en el catálogo de PostgreSQL que `save_inventory_combo` es `SECURITY INVOKER`, tiene `search_path` vacío, no concede ejecución a `anon` y sí a `authenticated`. Las tablas de combos mantienen RLS.
- Se generaron tipos desde la base remota y se confirmó que la nueva firma coincide exactamente. El archivo completo presenta diferencias anteriores en nulabilidad de columnas respecto del esquema local, además de diferencias del generador; no se sustituyó todo el archivo porque ocultaría ese desajuste. El control de tipos desde un reset local sigue pendiente.
- Se agregó `.vercelignore`: la comprobación de archivos de Vercel había incluido backups y temporales pese al `.gitignore`. El segundo dry-run confirmó que excluye su contenido y los secretos locales.
- Se intentó `vercel deploy --prod --skip-domain --yes` dos veces. Ambos intentos terminaron con `fetch failed`; no se obtuvo una nueva URL de despliegue ni se promovió una versión. La versión consultada antes de los intentos era `dpl_EidMfMfhpciNjcTNupyt4Qo4utEC`.
- La conexión también impidió repetir advisors y probar la llamada anónima después del despliegue de la función. La comprobación de permisos anterior sí terminó correctamente. El advisor previo reportó avisos sobre funciones existentes con `SECURITY DEFINER`, tablas cerradas con RLS sin políticas y protección de contraseñas filtradas desactivada; no constituye una auditoría de seguridad sin observaciones. Referencias: [funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [tablas sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) y [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- No hay ramas de desarrollo de Ilara en Supabase; Docker no tiene un motor Linux disponible. Las credenciales locales de Mercado Pago son de producción. No se realizó un cobro ni se envió un email de prueba.

## Implementado

- **Avisos de pedidos:** la acción de cambio de estado exige administrador, consulta el pedido con RLS y comprueba el estado y su evento persistido antes de enviar. Los nombres y cantidades del email salen de los ítems guardados, nunca de una lista enviada por el navegador. El proveedor tiene un timeout de ocho segundos y registra fallos sin datos personales. El panel avisa si guardó el estado pero no pudo enviar el email.
- **Combos:** alta y edición usan una sola RPC transaccional. Valida componentes y cantidades, conserva RLS y rechaza ediciones con una versión antigua. Un error revierte tanto la cabecera como los componentes.
- **Bolsa:** guarda referencias y cantidades, recupera precios y disponibilidad actuales, descarta almacenamiento malformado y reparte el stock compartido entre productos y combos. Antes de abrir el checkout vuelve a consultar el catálogo; si cambió el precio o stock, solicita revisar la bolsa.
- **Ficha del producto:** puede abrir el mismo checkout del catálogo, con entrega y pago. El cupón se conserva por código durante la sesión y se revalida al recuperarlo. Una respuesta tardía de recuperación no puede reemplazar una elección posterior del usuario.
- **Catálogo:** ordena productos y combos en una lista conjunta por el precio visible; la búsqueda ignora tildes. Se retiró la afirmación de envío gratis de los datos estructurados y se aclaró el texto de la ficha.
- **Pedidos del panel:** paginación de 50 registros, orden estable, carga con descarte de respuestas antiguas y errores visibles con reintento.
- **Tablero:** muestra un error y permite reintentar cuando falla la carga, en lugar de presentar ceros como resultados válidos.
- **Seguimiento:** la cabecera específica `Referrer-Policy: no-referrer` queda después de la regla general para que no sea reemplazada.

## Verificación

- `npm run test`: 45 archivos, 232 pruebas aprobadas, incluyendo nuevas regresiones de carrito, ordenamiento y autorización de notificaciones.
- `npx tsc --noEmit --incremental false`: aprobado.
- `npm run lint`: cero errores; 28 advertencias preexistentes en los scripts de `mockup`.
- `npm run build`: aprobado, 72 páginas. El ajuste posterior de concurrencia del cupón se verificó con TypeScript y lint.
- `node scripts/check-atomic-combo.mjs`: aprobado en PostgreSQL aislado con PGlite. Comprueba denegación para anónimo y no administrador, rollback de alta/edición, cantidades inválidas, componentes duplicados, edición válida y conflicto de versión. Usa las tablas, políticas y función del repositorio; no conecta a Supabase remoto.
- Navegador local a 390 × 844: ficha → agregar a bolsa → abrir bolsa → abrir datos del pedido. Formulario visible y sin errores de JavaScript. No se confirmó un pedido, pago o envío de email. Evidencia: `review-2026-09-05/checkout-mobile-fixed.png`.
- Respuesta HTTP local de seguimiento: `Referrer-Policy: no-referrer` y `Cache-Control: no-store`.

Para repetir la prueba PostgreSQL aislada, instalar primero su dependencia temporal (sin modificar las dependencias de la app):

```powershell
npm install --prefix tmp/review-db --no-save --package-lock=false @electric-sql/pglite
node scripts/check-atomic-combo.mjs
```

## Antes de publicar

1. Migración y despliegue completados; ver la confirmación al comienzo de este informe.
2. Ejecutar las comprobaciones existentes de integración, seguridad/RLS y generación de tipos contra Supabase local o staging. Docker no estuvo disponible: la prueba aislada no sustituye un reset de todas las migraciones. La firma nueva de tipos se añadió manualmente.
3. Verificar en staging con sesión administrativa la edición de combos, paginación de pedidos y tablero; completar un pedido de prueba con proveedores de prueba para cubrir pago y email de extremo a extremo.

## Oportunidades que siguen pendientes

La revisión inicial incluye mejoras de producto que no forman parte de estas correcciones: cola durable y reintentos de emails, observabilidad operativa, wishlist, recuperación de carritos y nuevas funciones comerciales. Se conserva la regla existente que oculta productos agotados. La revisión visual del panel autenticado y la validación integral en Supabase quedan pendientes de un entorno de prueba funcional.
