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

No se pudo generar el backup de producción: el archivo privado contiene un valor de un solo carácter y no proporciona una credencial válida; PostgreSQL rechazó la autenticación (`28P01`). Se descargó el certificado CA del panel del proyecto y se verificó TLS; no se deshabilitó la validación ni se cambió la contraseña.

Herramientas portátiles oficiales de PostgreSQL 17.11 disponibles en `tmp/postgres-tools`, fuera de Git y deploy, sin Docker ni instalación de un servicio. El dump debe conservarse cifrado fuera del repositorio; la restauración se ejecutará únicamente en un destino aislado, nunca sobre producción. Falta una credencial vigente antes de ejecutar y documentar este ejercicio. Los RPO/RTO históricos siguen siendo propuestas, no garantías verificadas.

## Evidencia local y bloqueos

- 57 migraciones completas y 52 tablas públicas con RLS aprobadas en PGlite.
- Pruebas reales de outbox: deduplicación, lease exclusivo, fencing, backoff persistido y no recuperación de trabajos enviados.
- Prueba del worker: cuerpo persistido antes del envío y reutilizado tras una ejecución fallida.
- 263 pruebas unitarias en 55 archivos, lint limpio y TypeScript aprobados.
- Build Next.js 16.3.7 aprobado, 74 páginas/rutas incluidas las dos rutas internas nuevas.
- Supabase cloud aún no ejecutado: FINSA Staging ya está pausado; FinningCAT e Ilara son los dos proyectos activos. Se requiere identificar que FinningCAT puede quedar temporalmente fuera de servicio antes de pausar otra aplicación.
- La CLI local sigue conectada a otra cuenta (Ilara Finanzas++/PaxIlara); el conector y el navegador sí acceden a Ilara. Los secrets de CI deben pertenecer a la cuenta y proyecto de staging correctos.
- Por decisión del propietario, la protección de contraseñas filtradas queda fuera del cierre; no se contrató Pro.
