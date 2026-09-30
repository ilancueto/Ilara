# Operación de Ilara: continuación del cierre

Publicado y verificado el 30/09/2026 mediante las PR #4 y #5. Release `44941bafccdffd2cbbb3430cccfefe8f786b2928`, deployment `dpl_3bz14xmkDCjJ2i5e8dBQWgzci2d5`, únicamente en Vercel ilara. Evidencia consolidada: [ESTADO.md](../ESTADO.md).

## Cola durable

La migración `20260930135157_durable_notification_outbox` agrega un outbox con RLS y acceso exclusivo de service role. Triggers de pedidos y pagos escriben el aviso en la misma transacción, sin rellenar avisos históricos. El rollback del pedido revierte también su aviso.

Cada combinación pedido/tipo se guarda una vez, siguiendo la deduplicación por tipo del flujo anterior. Un worker toma hasta tres avisos con SKIP LOCKED y leases de diez minutos. Cada lease tiene un token distinto; una ejecución vieja no puede completar un trabajo recuperado. Los fallos conservan un backoff de hasta una hora, con ocho intentos y un máximo de 22 horas para mantenerse dentro de la ventana de idempotencia del proveedor. No se promete entrega exactamente una vez más allá de esa ventana.

Antes del primer envío se guarda el cuerpo completo, incluido remitente, plantilla y enlace de seguimiento. Los reintentos reutilizan ese cuerpo y una clave estable del aviso. Pedidos sin email válido quedan `skipped`. Fallos definitivos quedan `failed` para revisión operativa, sin datos personales en respuestas o logs.

`POST /api/internal/order-notifications` exige CRON_SECRET. El workflow existente de expiración agrega el drenaje cada cinco minutos. La creación y los cambios administrativos intentan despachar su aviso inmediato; si no pueden enviarlo, el registro permanece para el worker. El webhook de Mercado Pago deja el envío al evento transaccional de la base, evitando un segundo camino independiente de envío.

## Alertas externas

`GET /api/internal/operations-health` exige CRON_SECRET y devuelve solamente configuración de envío y conteos. Rechaza el estado operativo si falta Resend/remitente, hay avisos fallidos o existen avisos pendientes de más de treinta minutos.

`operations-monitor.yml` comprueba cada hora el catálogo y la cola. Abre una única issue de incidente en GitHub y la cierra cuando la comprobación vuelve a pasar; el workflow fallido también queda registrado en GitHub Actions. Las notificaciones al propietario dependen de sus preferencias de GitHub. No se agrega un destinatario de email o un webhook de terceros sin un destino definido. La disponibilidad del scheduler de GitHub no constituye un SLA.

Monitor y cron ejecutados después del release: [monitor aprobado](https://github.com/ilancueto/Ilara/actions/runs/36768267970) y [expiración/worker aprobado](https://github.com/ilancueto/Ilara/actions/runs/36768271513). Los probes exigen HTTP 200 y JSON `ok: true`; una redirección ya no se acepta como éxito. Las dos rutas rechazan solicitudes sin credencial con 401. La recuperación del outbox se comprobó con fixtures revertidos en staging; no se generaron pedidos ni emails de prueba a clientes de producción.

## Backup y restauración

Backup de producción generado con PostgreSQL 17.11 mediante login temporal oficial de la CLI (TTL 300 segundos), usando el rol postgres con `default_transaction_read_only=on`. TLS verificado con la CA oficial. No se cambió la contraseña de producción ni se crearon datos de prueba allí. El rol temporal limitado `read_only:true` no permitió el dump de tablas protegidas; el dump exitoso utilizó el login temporal normal y transacciones forzadas a sólo lectura.

Archivo cifrado con AES-256-GCM en `backups/`, excluido de Git y deploy. Tamaño sin cifrar: 961726 bytes; SHA-256 `182f62ac52f41b4a2b9f9fe32e5585387c2bb90dd2c444b2de769d36faa98c3c`. Descifrado autenticado comprobado contra el archivo original. Restauración en una base separada y sin CONNECT público de ilara-staging: 85.8 segundos para pg_restore. Comparación por tabla de todas las filas serializadas con COPY: 89 tablas con hashes idénticos, incluidos datos de aplicación, Auth, Storage y migraciones. Ningún servicio de la aplicación se conectó a esa base.

Exclusiones de la restauración: datos de Vault, event triggers administrados por Supabase y `realtime.list_changes`, que requieren permisos internos del proveedor. No se restauraron propietarios ni ACL del sistema (`--no-owner --no-privileges`); las migraciones de la aplicación reproducen sus permisos en staging. Este ejercicio valida recuperación de datos y funciones restauradas, no el encendido de todos los servicios de un proyecto reemplazante. Storage verificado: 107 objetos (41692240 bytes) cifrados, restaurados en un bucket privado temporal y comparados byte a byte. Se eliminaron ese bucket, las copias temporales, la base aislada de restauración y el dump sin cifrar; permanecen los backups cifrados y claves privadas excluidos de Git/Vercel. No existe una copia externa automatizada certificada. Los RPO/RTO históricos siguen siendo propuestas; 85.8 segundos es tiempo de restore de esta muestra, no un SLA.

## Evidencia final

- 58 migraciones completas y 52 tablas públicas con RLS aprobadas en PGlite.
- Pruebas reales de outbox: deduplicación, lease exclusivo, fencing, backoff persistido y no recuperación de trabajos enviados.
- Prueba del worker: cuerpo persistido antes del envío y reutilizado tras una ejecución fallida.
- 267 pruebas unitarias en 55 archivos, lint limpio y TypeScript aprobados.
- Build Next.js 16.3.7 aprobado, 74 páginas/rutas incluidas las dos rutas internas nuevas.
- FinningCAT pausado con autorización explícita; ilara-staging creado en la organización de producción. FINSA Staging no fue modificado. Cuenta CLI correcta y secrets de GitHub configurados; pooler de sesión IPv4 verificado con TLS para Actions.
- Integración cloud: 105/105 en 15 archivos. Advisors, matriz anon/service, RLS 52/52, control negativo con rollback y tipos/drift aprobados. Outbox cloud aprobado con rollback de fixture.
- Cloud E2E final: 53/53. CI completo aprobado: [run 36766831095](https://github.com/ilancueto/Ilara/actions/runs/36766831095), con 267 unitarias y 105 de integración. Contraste real del botón de pago corregido; assertions de bolsa y target cloud alineadas con el flujo vigente.
- Dominio publicado: smoke 16/16 y SEO remoto de sólo lectura 14/14. Producción y staging saludables; FinningCAT permanece pausado para conservar el cupo Free de CI.
- Por decisión del propietario, la protección de contraseñas filtradas queda fuera del cierre; no se contrató Pro.
