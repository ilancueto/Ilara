# Informe de ejecución del plan de fixes y mejoras

**Fecha:** 23 de agosto de 2026  
**Entorno intervenido:** repositorio y stack Supabase local  
**Producción:** no se desplegó código, no se aplicaron migraciones remotas y no se modificaron datos reales.

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
| Supabase security advisors | Sin observaciones de seguridad |
| Edge Functions reales | Webhook mal configurado devuelve 503; passkeys devuelve 403 |
| `git diff --check` | Sin errores de whitespace |

La revisión visual se realizó en navegador real en desktop y en viewport móvil de 390 × 844. El CLI del navegador automatizado no estaba disponible en el entorno, por lo que se usó el navegador integrado como alternativa y Playwright para la verificación repetible.

## No ejecutado o fuera del alcance aprobado

- No se desplegó la aplicación ni las Edge Functions y no se aplicó la migración en producción.
- No se realizó una transacción real contra Mercado Pago ni un envío real de Resend; se probaron contratos, fallos cerrados y persistencia local sin usar servicios productivos.
- No se cambió el proveedor o mecanismo del cron existente.
- No se endureció CSP para retirar `unsafe-inline`.
- No se hicieron refactors grandes de componentes, paginación/búsqueda del catálogo en servidor ni un sistema de diseño nuevo.
- No se rediseñó el anuncio del catálogo, por decisión de alcance.
- Los 28 warnings de lint históricos en mockups/scripts se dejaron separados para evitar mezclar una limpieza mecánica con estos cambios funcionales.

## Pasos necesarios para publicar

1. Crear backup y revisar la migración en un entorno de staging.
2. Aplicar la migración de Supabase y desplegar `payments-mp-webhook` y el handler contenido de `passkey-auth`.
3. Desplegar la aplicación Next.js.
4. Verificar en el entorno destino `RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, credenciales de Mercado Pago y secretos del job de expiración.
5. Ejecutar smoke de creación de pedido, email, apertura cross-device, upload/finalización de comprobante y webhook firmado.
6. Monitorear errores de email, reservas de upload vencidas y respuestas 5xx del webhook durante la salida.

Hasta completar esos pasos, el trabajo está terminado y validado **localmente**, pero no activo para usuarios de producción.
