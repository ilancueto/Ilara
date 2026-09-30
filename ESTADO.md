# Estado actual de Ilara

Revisión cerrada el 30/09/2026. Código integrado en `main`, cambios originales preservados y sitio publicado en [ilara.com.ar](https://ilara.com.ar), únicamente en Vercel `ilara` (`prj_l1212uETlGghvn8jChfiXCp68SzN`). PR [#4](https://github.com/ilancueto/Ilara/pull/4) y corrección operativa [#5](https://github.com/ilancueto/Ilara/pull/5). Commit de release `44941bafccdffd2cbbb3430cccfefe8f786b2928`; deployment `dpl_3bz14xmkDCjJ2i5e8dBQWgzci2d5`.

## Validación real

| Control | Resultado |
|---|---|
| Unitarias | 267 aprobadas en 55 archivos |
| Integración Supabase cloud | 105/105 en 15 archivos |
| Navegador cloud desktop/mobile | 53/53, incluidos POS, pedidos, devoluciones, CRM, finanzas, stock, accesibilidad y PWA |
| CI final | [Run aprobado](https://github.com/ilancueto/Ilara/actions/runs/36766831095) |
| Lint, TypeScript y build | Aprobados; Next.js 16.3.7 |
| SQL aislado complementario | 58 migraciones completas; 52 tablas públicas con RLS |
| Staging: advisors, RLS, matriz anon/service, control negativo y tipos/drift | Aprobados; política de control revertida con rollback |
| Cola durable cloud | Encolado, lease exclusivo, fencing, reintento persistente y deduplicación; fixture revertido |
| Dominio publicado | Smoke 16/16; SEO remoto de sólo lectura 14/14 |
| Rutas operativas | 401 sin credencial; HTTP 200 autenticado; salud operativa correcta |
| Monitor externo | [Run aprobado](https://github.com/ilancueto/Ilara/actions/runs/36768267970) |
| Cron de expiración y worker | [Run aprobado](https://github.com/ilancueto/Ilara/actions/runs/36768271513) |
| Backup/restore | 89 tablas con hashes idénticos; 107 archivos de Storage restaurados y comparados byte a byte |

Las pruebas mutantes se ejecutaron exclusivamente en `ilara-staging` (`pwbgwzrilbgozwzfzegn`). No se utilizaron Docker ni Supabase local en la computadora ni en CI. Producción `qbbnvdmadgomfmrsfxlo` conserva sus datos; no se crearon pedidos, usuarios, cobros ni mensajes de prueba allí. Las APIs de pago/logística/email de las suites se simulan: estos resultados no certifican un cobro ni un envío real del proveedor.

## Correcciones publicadas

- Next.js, ESLint y analyzer 16.3.7; auditoría npm sin vulnerabilidades en esta revisión.
- Catálogo completo por rangos, cantidad exacta y orden estable; nunca publica una lectura parcial. Más vendidos conserva el ranking SSR durante hidratación.
- Fichas inexistentes devuelven 404; paginación, queries, canonical/noindex, sitemap y schema corregidos. Contraste de botones del storefront corregido.
- RPC de Mercado Pago reservadas al backend y predicados de permisos INVOKER. Tipos generados desde staging, alineado con la nullabilidad y defaults reales de producción sin reescribir filas.
- Outbox de notificaciones en la transacción del pedido/pago, RLS y acceso exclusivo de service role. Reintentos inmediatos más recuperación entre ejecuciones con cuerpo persistido, clave estable, backoff y leases con fencing. El webhook actualizado usa este único camino durable.
- Monitor externo en GitHub y worker cada cinco minutos. Las rutas internas llegan a sus handlers sin sesión del navegador, pero exigen CRON_SECRET. Los workflows requieren HTTP 200 y JSON `ok: true`; una redirección al login ya no puede simular éxito.
- Fixtures cloud repetibles, limpieza financiera comprobada y fechas de CRM independientes del reloj de la computadora. Credenciales de proveedores reales bloqueadas durante las pruebas.

## Infraestructura y recuperación

FinningCAT quedó pausado con autorización explícita para liberar el cupo Free; `ilara-staging` permanece activo para CI. FINSA Staging y las aplicaciones de otras organizaciones no fueron modificadas. CLI conectada a la cuenta correcta y seis secrets de staging configurados en GitHub, con pooler de sesión IPv4 y TLS verificado mediante la CA oficial. No se cambió la contraseña de producción ni se contrató Pro.

Backup cifrado AES-256-GCM conservado en `backups/`, excluido de Git y Vercel. Dump previo al release: 961726 bytes, SHA-256 `182f62ac52f41b4a2b9f9fe32e5585387c2bb90dd2c444b2de769d36faa98c3c`. Restauración PostgreSQL: 85.8 segundos; 89 tablas comparadas. Storage: 107 objetos y 41692240 bytes comparados. Base de restauración separada sin CONNECT público, bucket privado de prueba y dump sin cifrar eliminados al terminar. Credenciales temporales de la CLI con TTL 300 segundos; ninguna clave fue publicada.

El ejercicio excluye datos de Vault y hooks del proveedor que necesitan privilegios internos; no recrea propietarios/ACL del sistema ni prueba el encendido de todos los servicios de un proyecto sustituto. No hay un SLA de recuperación ni una copia externa automatizada certificada. Detalle: [operación y recuperación](docs/OPERACION_2026-09-30.md).

## Límites acordados

La protección contra contraseñas filtradas quedó fuera del cierre por decisión del propietario. La PWA requiere internet. Etiquetas/tracking automático, wishlist, recuperación de carritos, compras/proveedores y lotes siguen siendo ampliaciones del producto. Los componentes grandes pueden seguir extrayéndose en cambios acotados; no representan por sí solos una falla funcional.

El outbox limita el reintento a ocho intentos y 22 horas dentro de la ventana de idempotencia del proveedor; los fallos definitivos requieren revisión. Las notificaciones de issues dependen de las preferencias de GitHub y su scheduler no constituye un SLA. La cola durable, el monitor y el ejercicio de restauración están implementados y verificados dentro del alcance documentado.

Los informes de agosto y del 5/09 son históricos. Se revisaron las 26 capturas antes de publicar y se preservaron los archivos originales. Las credenciales privadas, backups y artefactos temporales están excluidos de Git y deploy.
