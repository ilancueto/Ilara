# Operación de Ilara: continuación del cierre

Esta continuación no está desplegada. La PR #4 conserva la publicación anterior; las siguientes mejoras requieren validación cloud y un nuevo release.

## Cola durable

La migración `20260930135157_durable_notification_outbox` agrega un outbox con RLS y acceso exclusivo de service role. Triggers de pedidos y pagos escriben el aviso en la misma transacción, sin rellenar avisos históricos. El rollback del pedido revierte también su aviso.

Cada combinación pedido/tipo se guarda una vez, siguiendo la deduplicación por tipo del flujo anterior. Un worker toma hasta tres avisos con SKIP LOCKED y leases de diez minutos. Cada lease tiene un token distinto; una ejecución vieja no puede completar un trabajo recuperado. Los fallos conservan un backoff de hasta una hora, con ocho intentos y un máximo de 22 horas para mantenerse dentro de la ventana de idempotencia del proveedor. No se promete entrega exactamente una vez más allá de esa ventana.

Antes del primer envío se guarda el cuerpo completo, incluido remitente, plantilla y enlace de seguimiento. Los reintentos reutilizan ese cuerpo y una clave estable del aviso. Pedidos sin email válido quedan `skipped`. Fallos definitivos quedan `failed` para revisión operativa, sin datos personales en respuestas o logs.

`POST /api/internal/order-notifications` exige CRON_SECRET. El workflow existente de expiración agrega el drenaje cada cinco minutos. La creación y los cambios administrativos intentan despachar su aviso inmediato; si no pueden enviarlo, el registro permanece para el worker. El webhook de Mercado Pago deja el envío al evento transaccional de la base, evitando un segundo camino independiente de envío.

## Alertas externas

`GET /api/internal/operations-health` exige CRON_SECRET y devuelve solamente configuración de envío y conteos. Rechaza el estado operativo si falta Resend/remitente, hay avisos fallidos o existen avisos pendientes de más de treinta minutos.

`operations-monitor.yml` comprueba cada hora el catálogo y la cola. Abre una única issue de incidente en GitHub y la cierra cuando la comprobación vuelve a pasar; el workflow fallido también queda registrado en GitHub Actions. Las notificaciones al propietario dependen de sus preferencias de GitHub. No se agrega un destinatario de email o un webhook de terceros sin un destino definido. La disponibilidad del scheduler de GitHub no constituye un SLA.

Después de publicar en main, ejecutar manualmente el monitor y el worker, verificar las respuestas autenticadas y el comportamiento de recuperación con fixtures de staging. No generar pedidos ni emails de prueba a clientes de producción.

## Backup y restauración

Backup de producción generado con PostgreSQL 17.11 mediante login temporal oficial de la CLI (TTL 300 segundos), usando el rol postgres con `default_transaction_read_only=on`. TLS verificado con la CA oficial. No se cambió la contraseña de producción ni se crearon datos de prueba allí. El rol temporal limitado `read_only:true` no permitió el dump de tablas protegidas; el dump exitoso utilizó el login temporal normal y transacciones forzadas a sólo lectura.

Archivo cifrado con AES-256-GCM en `backups/`, excluido de Git y deploy. Tamaño sin cifrar: 961726 bytes; SHA-256 `182f62ac52f41b4a2b9f9fe32e5585387c2bb90dd2c444b2de769d36faa98c3c`. Descifrado autenticado comprobado contra el archivo original. Restauración en una base separada y sin CONNECT público de ilara-staging: 85.8 segundos para pg_restore. Comparación por tabla de todas las filas serializadas con COPY: 89 tablas con hashes idénticos, incluidos datos de aplicación, Auth, Storage y migraciones. Ningún servicio de la aplicación se conectó a esa base.

Exclusiones de la restauración: datos de Vault, event triggers administrados por Supabase y `realtime.list_changes`, que requieren permisos internos del proveedor. No se restauraron propietarios ni ACL del sistema (`--no-owner --no-privileges`); las migraciones de la aplicación reproducen sus permisos en staging. Este ejercicio valida recuperación de datos y funciones restauradas, no el encendido de todos los servicios de un proyecto reemplazante. La prueba de archivos binarios de Storage está en ejecución. Los RPO/RTO históricos siguen siendo propuestas; 85.8 segundos es tiempo de restore de esta muestra, no un SLA.

## Evidencia local y bloqueos

- 58 migraciones completas y 52 tablas públicas con RLS aprobadas en PGlite.
- Pruebas reales de outbox: deduplicación, lease exclusivo, fencing, backoff persistido y no recuperación de trabajos enviados.
- Prueba del worker: cuerpo persistido antes del envío y reutilizado tras una ejecución fallida.
- 263 pruebas unitarias en 55 archivos, lint limpio y TypeScript aprobados.
- Build Next.js 16.3.7 aprobado, 74 páginas/rutas incluidas las dos rutas internas nuevas.
- FinningCAT pausado con autorización explícita; ilara-staging creado en la organización de producción. FINSA Staging no fue modificado. Cuenta CLI correcta y secrets de GitHub configurados; pooler de sesión IPv4 verificado con TLS para Actions.
- Integración cloud: 105/105 en 15 archivos. Advisors, matriz anon/service, RLS 52/52, control negativo con rollback y tipos/drift aprobados. Outbox cloud aprobado con rollback de fixture.
- Primera E2E cloud: 49/51; corregido contraste real del botón de pago y dos assertions antiguas de loopback. Segunda: 50/51; la prueba esperaba un botón de cierre eliminado por el diseño actual. Ahora usa «Volver a la bolsa» y verifica desmontaje. Validación final y CI pendientes.
- Por decisión del propietario, la protección de contraseñas filtradas queda fuera del cierre; no se contrató Pro.
