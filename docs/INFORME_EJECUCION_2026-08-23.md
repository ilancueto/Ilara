# Informe de ejecución del plan de fixes y mejoras

**Fecha:** 23 de agosto de 2026  
**Entorno intervenido:** repositorio, Supabase local y producción
**Producción:** publicada y verificada el 23 de agosto de 2026.

## Resultado ejecutivo

Se completó el alcance aprobado: upload directo firmado de comprobantes, email automático con WhatsApp manual, enlaces de seguimiento temporales y revocables, eliminación de la implementación histórica de passkeys, hardening del webhook de Mercado Pago, retiro de PII del frontend, privacidad de las rutas de pedido y mejoras de accesibilidad/mobile sin rediseñar la identidad del catálogo.

La implementación compila y quedó validada localmente con pruebas unitarias, integración real contra Supabase local, ejecución de Edge Functions, matriz de seguridad, Axe, teclado, escritorio y mobile. La suite E2E final terminó con **46/46 escenarios aprobados**.

## Cambios implementados

### 1. Comprobantes: upload directo y seguro

- El navegador sube el archivo directamente al bucket privado mediante una URL firmada de corta duración; el binario ya no atraviesa una Server Action ni una Vercel Function.
- El servidor reserva un path único y valida capacidad, pago, extensión, MIME y límite de 5 MB antes de firmar.
- La finalización vuelve a descargar el objeto desde Storage y verifica tamaño, extensión, MIME real y magic bytes para JPEG, PNG, WebP y PDF.
- El hash SHA-256 se calcula del lado servidor y la reserva solo puede consumirse una vez.
- Los RPC de preparar/finalizar quedaron revocados para `public`, `anon` y `authenticated`; solo el backend con `service_role` puede invocarlos.
- Los objetos inválidos, reemplazados o cuya finalización falla se eliminan. El job existente de expiración también limpia reservas y objetos incompletos vencidos.
- Se agregó la migración `20260823212710_secure_receipt_uploads_and_notification_links.sql` y se regeneraron los tipos de base.

### 2. Notificaciones y seguimiento entre dispositivos

- La creación de un pedido intenta enviar automáticamente el email transaccional y devuelve el canal realmente utilizado.
- El email incluye el resumen del pedido y usa clave de idempotencia para evitar duplicados del proveedor.
- WhatsApp queda como acción manual visible: al compartir se crea un enlace propio, no se reutiliza ni expone el token largo original.
- Los enlaces de email/WhatsApp son capacidades aleatorias almacenadas únicamente como hash, con vencimiento de 7 días, un solo canje y revocación.
- Al abrir el enlace en un navegador nuevo, se canjea por una sesión de seguimiento HTTP-only de 30 días y se limpia el token de la URL.
- Se conserva compatibilidad con los enlaces históricos existentes.

### 3. Seguridad y privacidad

- El webhook de Mercado Pago ahora falla cerrado con `503` si faltan el access token o el secreto de firma; ya no confirma silenciosamente un evento que no puede procesar.
- Los emails personales fueron eliminados del componente cliente. El saludo usa metadata de presentación y conserva la autorización separada.
- `/pedido` y `/pedido/[orderNumber]` declaran `noindex`, `nofollow` y una política de referrer restrictiva.
- La implementación histórica de passkeys y la dependencia `supakeys` fueron eliminadas. La Edge Function restante es un cierre mínimo que siempre responde `403`; si la función vuelve al producto deberá diseñarse desde cero.
- La matriz de seguridad cubre las nuevas tablas internas de uploads, links y sesiones.

### 4. Accesibilidad y experiencia visual

- Se corrigieron los contrastes detectados por Axe en catálogo claro/oscuro y en el diálogo de acciones masivas.
- Se retiró la desactivación global de la regla `color-contrast` en las suites E2E.
- La galería ahora se abre con un botón semántico, nombre accesible, foco y teclado; también se cubre el estado sin imagen.
- Se aumentaron targets táctiles principales a aproximadamente 44 px y se mejoró la legibilidad de textos comerciales y secundarios en mobile.
- Se corrigió una superposición entre nombre y precio en la grilla desktop.
- Se mantuvieron la estética, la paleta, la grilla mobile de dos columnas y el diseño del anuncio existente.

## Verificaciones realizadas

| Control | Resultado |
| --- | --- |
| Unitarias (`npm test`) | 42 archivos, 218 pruebas aprobadas |
| TypeScript (`npx tsc --noEmit`) | Aprobado |
| Build de producción (`npm run build`) | Aprobado; 87 páginas estáticas generadas |
| ESLint (`npm run lint`) | 0 errores; 28 warnings preexistentes en mockups/scripts |
| Playwright E2E completo | 46/46 aprobados en desktop y mobile |
| Axe con contraste habilitado | Aprobado en las superficies cubiertas |
| Integración upload/link seguro | 2/2 aprobados contra Supabase local |
| Matriz de seguridad RLS/grants | Aprobada para anon y service role |
| Cobertura RLS | 51 tablas aprobadas |
| Drift de tipos de base | Sin drift |
| Supabase security advisors locales | Sin observaciones de seguridad |
| Edge Functions reales | Webhook mal configurado devuelve 503; passkeys devuelve 403 |
| `git diff --check` | Sin errores de whitespace |

La revisión visual se realizó en navegador real en desktop y en viewport móvil de 390 × 844. El CLI del navegador automatizado no estaba disponible en el entorno, por lo que se usó el navegador integrado como alternativa y Playwright para la verificación repetible.

## Publicación productiva

- Se creó un backup lógico previo en `C:\Users\ilaan\ilara-backups\2026-08-23-pre-secure-order-release`, con dumps de esquema, datos, roles e historial de migraciones y hashes SHA-256 registrados.
- No existe un proyecto de staging de Ilara. La migración se ensayó contra la base local reconstruida y validada; no se utilizó el proyecto ajeno `FINSA Staging`.
- Se aplicó en Supabase productivo la migración `20260823212710_secure_receipt_uploads_and_notification_links.sql`.
- Se desplegaron `passkey-auth` v10, `payments-mp-webhook` v8 y, tras un hallazgo del monitoreo, `shipping-quotes` con fallback resiliente de Georef.
- Se agregó `NEXT_PUBLIC_SITE_URL=https://ilara.com.ar` a Production, Preview y Development de Vercel, y `SITE_URL` a los secretos de Edge Functions. Las demás variables requeridas estaban presentes.
- La aplicación se publicó primero sin dominios y luego se promovió exactamente el deployment `dpl_5qTUiJRBMVHzjMgrAkwJ3EefCyTY` a `https://ilara.com.ar`.
- El smoke productivo recorrió catálogo y checkout en navegador real, creó un pedido de retiro, confirmó el envío de email a la casilla segura de pruebas de Resend, subió y finalizó un PNG mediante URL firmada, canjeó un enlace en un contexto nuevo y validó que la URL quedara limpia.
- El webhook con firma válida alcanzó Mercado Pago y devolvió el `502` esperado para el ID sintético inexistente; las solicitudes sin firma y el endpoint retirado de passkeys devolvieron `401` y `403` respectivamente.
- Pedido, pago, archivo, links, sesiones y cotizaciones temporales fueron eliminados. La auditoría posterior encontró cero pedidos de smoke residuales.
- El monitoreo detectó que Georef v2 respondía `502`. Se agregó fallback al endpoint oficial compatible, se redesplegó `shipping-quotes` y se verificaron 24 provincias, 49 localidades y 4 opciones de envío; esos registros de prueba también se eliminaron.
- En Vercel no hubo respuestas `500` ni warnings posteriores al smoke. El único log marcado como error fue una validación `invalid_customer_email` provocada deliberadamente durante la exploración inicial y respondió HTTP 200 con error de formulario controlado.
- Los logs de Supabase confirmaron upload y borrado del objeto, canje del link y limpieza de datos. Los `502` del webhook corresponden al ID sintético esperado; los de `shipping-quotes` son anteriores al fallback y la prueba posterior terminó en `200`.

## Pendiente o fuera del alcance aprobado

- No se realizó un cobro monetario real contra Mercado Pago. Se verificaron firma, conectividad y fallo seguro con un ID sintético para no generar movimientos.
- No existe un staging remoto dedicado de Ilara; conviene crear uno antes del siguiente cambio de datos significativo.
- No se cambió el proveedor o mecanismo del cron existente.
- No se endureció CSP para retirar `unsafe-inline`.
- El linter remoto de Supabase conserva 55 advertencias heurísticas sobre RPC `SECURITY DEFINER`: 54 corresponden a superficies públicas por capability o RPC autenticados que validan permisos internamente, y una a la protección de contraseñas filtradas desactivada. Conviene revisarlas en una auditoría dedicada y habilitar la protección de contraseñas tras validar el impacto en Auth.
- Persiste una advertencia de performance por dos políticas `SELECT` permisivas en `user_roles`; no bloquea la salida, pero puede consolidarse en una migración futura.
- No se hicieron refactors grandes de componentes, paginación/búsqueda del catálogo en servidor ni un sistema de diseño nuevo.
- No se rediseñó el anuncio del catálogo, por decisión de alcance.
- Los 28 warnings de lint históricos en mockups/scripts se dejaron separados para evitar mezclar una limpieza mecánica con estos cambios funcionales.

## Cierre de los pasos de publicación

Los seis pasos fueron completados. El único sustituto documentado fue usar la base local reconstruida como staging porque no hay un staging remoto de Ilara. La aplicación y la migración están activas para usuarios de producción.
