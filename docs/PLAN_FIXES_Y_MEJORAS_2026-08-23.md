# Plan propuesto de fixes y mejoras

**Fecha:** 23 de agosto de 2026  
**Origen:** [Auditoría integral de Ilara](AUDITORIA_INTEGRAL_2026-08-23.md)  
**Estado:** alcance aprobado implementado y validado localmente. Ver [informe de ejecución](INFORME_EJECUCION_2026-08-23.md). El despliegue a producción sigue pendiente.  
**Estimaciones:** días de desarrollo de una persona, incluyendo implementación y pruebas. No son fechas calendario.

## Objetivo

Convertir los 16 hallazgos de la auditoría en paquetes de trabajo pequeños, verificables y reversibles. El plan separa:

- **Base recomendada:** corrige riesgos que hoy pueden afectar pagos, pedidos, privacidad o accesibilidad.
- **Mejoras aconsejables:** reducen deuda operativa y mejoran la cobertura.
- **Sugerencias opcionales:** tienen valor, pero pueden esperar hasta que el producto o el volumen lo justifiquen.

La aprobación debe hacerse por paquete. Aprobar este documento no implica ejecutar automáticamente todo el backlog.

## Estados para la decisión

| Estado | Significado |
| --- | --- |
| `Pendiente` | Todavía no decidido. |
| `Aprobar` | Se incorpora al alcance. |
| `Posponer` | Es válido, pero no entra en la próxima ejecución. |
| `Descartar` | Se acepta conscientemente el riesgo o no aplica al producto. |

## Alcance recomendado

### Base mínima recomendada

| Orden | Paquete | Hallazgos | Esfuerzo | Decisión |
| ---: | --- | --- | ---: | --- |
| 1 | FX-01 Webhook de Mercado Pago fail-closed | ILR-02 | 0,5–1 día | **Implementado localmente** |
| 2 | FX-05 Retiro de PII del frontend | ILR-05 | 0,25–0,5 día | **Implementado localmente** |
| 3 | FX-07 Simplificación de passkeys contenidas | ILR-10 | 0,5–1 día | **Implementado: histórico eliminado** |
| 4 | FX-09 Privacidad/SEO de rutas de pedido | ILR-15 | 0,25–0,5 día | **Implementado localmente** |
| 5 | FX-02 Upload seguro de comprobantes | ILR-01, ILR-07 | 4–6 días | **Implementado: upload directo** |
| 6 | FX-03 Notificaciones y seguimiento cross-device | ILR-04 | 4–6 días | **Implementado: 2A + 3A** |
| 7 | FX-04 Accesibilidad y legibilidad pública | ILR-03, ILR-08 | 2–4 días | **Implementado: 5B** |
| 8 | FX-06 Tests reales de integraciones críticas | ILR-06 | 3–5 días | **Implementado para el alcance crítico; ampliación pendiente** |

**Total orientativo de la base:** 14,5–24 días, según las decisiones de upload y notificaciones.

### Mejoras aconsejables posteriores

| Paquete | Hallazgos | Esfuerzo | Decisión |
| --- | --- | ---: | --- |
| FX-08 Consolidación documental y cron | ILR-11 | 1–2 días | Pendiente |
| FX-10 Limpieza de tooling y warnings | ILR-16 | 0,5–1 día | Pendiente |
| MJ-01 DTOs y columnas explícitas | ILR-14 | 1–2 días | Pendiente |
| MJ-02 Observabilidad comercial | Sugerencia | 1–3 días | Pendiente |
| MJ-03 Revisión visual autenticada y regresión | Sugerencia | 1–2 días | Pendiente |

### Backlog opcional

| Paquete | Hallazgos | Activador recomendado | Decisión |
| --- | --- | --- | --- |
| OP-01 CSP sin `unsafe-inline` | ILR-12 | Después de estabilizar pagos y notificaciones | Pendiente |
| OP-02 Refactor incremental de componentes grandes | ILR-09 | Al volver a tocar cada módulo | Pendiente |
| OP-03 Paginación/búsqueda de catálogo en servidor | ILR-13 | Al superar el presupuesto de peso o cantidad de SKUs | Pendiente |
| OP-04 Sistema de diseño compartido | Sugerencia visual | Antes de una nueva expansión importante del panel | Pendiente |
| OP-05 Ajustes de anuncio y targets móviles | Sugerencia visual | Junto con la próxima iteración del catálogo | **Parcial: targets/textos incluidos en 5B; anuncio pendiente** |

## Secuencia y dependencias

```text
Quick fixes ───────────────┐
                          ├──> Release de hardening
Upload de comprobantes ───┤
Notificaciones/links ─────┤
Accesibilidad pública ────┘
             │
             └──> Tests de integración + observabilidad
                         │
                         └──> Refactors y optimizaciones opcionales
```

- FX-01, FX-05, FX-07 y FX-09 son independientes y pueden salir primero.
- FX-02 debe resolverse antes de cerrar los tests del flujo de comprobantes en FX-06.
- FX-03 necesita una decisión de producto sobre el canal de notificación y una decisión técnica sobre el enlace seguro.
- FX-04 debe completarse antes de volver a habilitar contraste en CI.
- Los refactors grandes no deben mezclarse con fixes comerciales; dificultarían revisión y rollback.

## Paquetes de fixes

### FX-01 — Webhook de Mercado Pago fail-closed

**Recomendación:** aprobar.

**Trabajo**

1. Cambiar la respuesta cuando falta o es inválido `MERCADOPAGO_ACCESS_TOKEN`: `500`/`503`, nunca `200`.
2. Registrar un evento estructurado sin imprimir secretos, payloads completos ni PII.
3. Diferenciar explícitamente configuración inválida, firma inválida, pago inexistente y error temporal de Mercado Pago.
4. Mantener éxito idempotente para eventos válidos ya procesados.
5. Añadir test ejecutable de la Edge Function con Supabase CLI.

**Criterios de aceptación**

- Token ausente o corto devuelve error reintentable.
- Firma inválida no modifica la base.
- Un evento válido se procesa una sola vez aunque se repita.
- CI prueba respuestas y efectos, no solo strings del archivo.
- Los logs permiten detectar la causa sin exponer credenciales.

**Rollback:** redeploy de la versión anterior de la Edge Function. No requiere migración.

### FX-02 — Upload seguro de comprobantes

**Recomendación:** aprobar la opción A.

#### Opción A — Upload directo firmado a Supabase Storage

Es la solución recomendada porque evita tanto el límite de 1 MB de Server Actions como el límite de 4,5 MB de Vercel Functions.

**Trabajo**

1. Validar la capacidad del pedido antes de preparar el upload.
2. Reservar un path único y generar un token con `createSignedUploadUrl` desde servidor.
3. Subir el archivo desde el navegador con `uploadToSignedUrl`, sin exponer `service_role` ni abrir el bucket.
4. Finalizar el upload en servidor: validar objeto, tamaño, tipo real, path reservado y estado del pedido.
5. Inspeccionar magic bytes de JPEG, PNG, WebP y PDF antes de aceptar el comprobante.
6. Eliminar inmediatamente archivos inválidos o cuyo RPC de finalización falle.
7. Crear reconciliación para reservas/objetos abandonados.
8. Mantener el bucket privado y revisar RLS/grants/advisors después de cualquier migración.

Supabase soporta actualmente [`createSignedUploadUrl`](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) y [`uploadToSignedUrl`](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl).

**Criterios de aceptación**

- Un archivo válido de 5 MB llega a Storage sin atravesar una Function de Vercel.
- Archivos de 0 bytes, mayores al límite, con MIME falso o magic bytes inválidos se rechazan y eliminan.
- Un token no puede escribir fuera del path reservado ni reutilizarse para sobrescribir otro comprobante.
- La caída entre upload y finalize no deja objetos permanentes.
- Se prueban límites inferior, exacto y superior.

**Esfuerzo:** 4–6 días.

#### Opción B — Solución temporal reduciendo el máximo

Reducir interfaz y backend a un máximo seguro inferior a 1 MB, manteniendo Server Actions. Es más rápida, pero empeora la experiencia y no resuelve la arquitectura.

**Esfuerzo:** 0,5–1 día.  
**Uso recomendado:** solo como mitigación inmediata si la opción A se posterga.

**Decisión tomada el 23/08/2026:** implementar **Opción A, upload directo firmado**.

### FX-03 — Notificaciones y seguimiento cross-device

**Recomendación:** aprobar, después de definir el canal.

**Decisión de producto necesaria**

- **Recomendada:** email transaccional como canal automático y WhatsApp como acción manual/alternativa visible.
- Alternativa: solo email.
- Alternativa: no enviar aviso inicial y corregir la documentación/UX para declararlo explícitamente.

**Diseño técnico recomendado**

1. Unificar creación y cambios de estado bajo un servicio de notificación con contrato explícito.
2. Eliminar `_notify` y `notifiedVia` ficticios o hacer que representen el resultado real.
3. Crear una capacidad de seguimiento de corta duración, revocable y almacenada como hash para cada notificación.
4. Permitir que el enlace reclame una cookie segura en un navegador nuevo.
5. No guardar ni reenviar en claro el token largo original del pedido.
6. Registrar intento, canal, resultado y causa genérica, sin contenido del email ni PII innecesaria.
7. Definir retry acotado para fallos temporales del proveedor.

**Criterios de aceptación**

- El pedido nuevo genera el aviso configurado o informa de forma visible que no pudo hacerlo.
- Un link abierto en navegador limpio autoriza únicamente ese pedido.
- Un link vencido/revocado no funciona y ofrece recuperación segura.
- Repetir una notificación no duplica efectos de negocio.
- Existen pruebas para creación, cambio de estado, navegador nuevo, expiración y proveedor caído.
- README y `.env.example` coinciden con el comportamiento final.

**Esfuerzo:** 4–6 días. Puede requerir migración y configuración del proveedor de email.

### FX-04 — Accesibilidad y legibilidad pública

**Recomendación:** aprobar sin cambiar la identidad visual.

**Trabajo**

1. Crear tokens de texto y estado con contraste AA para light y dark.
2. Corregir primero eyebrow, nota flotante, categoría, precio por transferencia y contadores activos.
3. Convertir la apertura de galería en un botón semántico con foco visible, `Enter` y `Space`.
4. Subir tamaños móviles efectivos: metadatos secundarios a 12 px como mínimo y texto comercial principal a 14 px cuando corresponda.
5. Revisar targets de 34–38 px y llevar acciones principales a ~44 px cuando no rompa la composición.
6. Probar 320, 360 y 390 px, dark/light y zoom 200 %.
7. Volver a habilitar `color-contrast` en Axe; cualquier excepción debe limitarse al nodo decorativo justificado.

**Criterios de aceptación**

- Axe no reporta violaciones serias WCAG A/AA en catálogo, login, bolsa y checkout.
- La galería se abre y cierra solo con teclado.
- No hay overflow horizontal ni superposiciones en los tres anchos móviles.
- El catálogo conserva la paleta y jerarquía de marca.
- Existe comparación visual antes/después aprobada.

**Esfuerzo:** 2–4 días.

### FX-05 — Retiro de PII del frontend

**Recomendación:** aprobar.

**Trabajo**

- Eliminar los emails personales usados por `getSaludo`.
- Resolver el nombre desde perfil o desde una propiedad preparada en servidor.
- No usar `user_metadata` para autorización; únicamente para presentación. Roles y permisos deben seguir en `app_metadata`/tabla protegida.
- Definir fallback “Cuenta activa”.

**Criterios de aceptación**

- Ningún email personal está presente en los chunks frontend ni en el repositorio de UI.
- El saludo funciona para usuarios existentes y nuevos.
- No cambia la lógica de roles.

**Esfuerzo:** 0,25–0,5 día.

### FX-06 — Tests reales de integraciones críticas

**Recomendación:** aprobar después de FX-01 a FX-03.

**Trabajo**

1. Servir funciones Edge localmente con `supabase functions serve`.
2. Incorporar servidores fake deterministas para Mercado Pago, shipping y email.
3. Probar HTTP, firma, timeouts, reintentos, idempotencia y efectos en base.
4. Mantener tests de `readFileSync` solo como guardrails secundarios.
5. Hacer que CI falle si las funciones no arrancan o si faltan variables locales obligatorias.

**Matriz mínima**

| Flujo | Casos obligatorios |
| --- | --- |
| Webhook MP | firma válida/inválida, token ausente, evento repetido, upstream 404/500/timeout |
| Preferencia MP | capability válida/inválida, idempotencia, respuesta incompleta |
| Comprobante | límites, MIME falso, finalize fallido, token reutilizado, cleanup |
| Shipping | éxito, localidad inválida, timeout, respuesta parcial |
| Email/seguimiento | éxito, proveedor caído, link nuevo/vencido/revocado |

**Criterios de aceptación**

- Los tests ejecutan el handler y comprueban estado HTTP más efecto persistido.
- Ninguna prueba depende de servicios productivos.
- CI es reproducible desde migraciones en cero.

**Esfuerzo:** 3–5 días.

### FX-07 — Simplificación de passkeys contenidas

**Recomendación:** aprobar si passkeys no se retomarán de inmediato.

**Trabajo**

- Reducir `passkey-auth` a un handler mínimo que siempre devuelve 403.
- Quitar la implementación histórica y el segundo booleano de activación.
- Mantener un test de que todas las rutas conocidas fallan cerradas.
- Archivar el diseño anterior en documentación, no como código desplegable.
- Si se retoman, crear una función nueva usando el soporte actual de Supabase Auth Passkeys —hoy en beta— y someterla a revisión específica.

**Criterios de aceptación**

- No existe un cambio de un único flag capaz de reactivar el código histórico.
- Login y smoke no muestran ni invocan passkeys.
- La función bloqueada no usa `service_role` ni lógica innecesaria.

**Esfuerzo:** 0,5–1 día.

**Decisión tomada el 23/08/2026:** **eliminar la implementación histórica desplegable**. Si passkeys vuelve al producto, se diseñará desde cero sobre la solución vigente en ese momento.

### FX-08 — Consolidación documental y cron

**Recomendación:** aprobar después de los fixes funcionales.

**Trabajo**

1. Crear un único documento de estado operativo actual.
2. Marcar auditorías, planes y runbooks viejos como históricos/archivados.
3. Unificar PWA como online-only, Node 22 y contrato real de notificaciones.
4. Resolver la contradicción del cron:
   - **Opción recomendada si el workflow actual es estable:** conservar GitHub Actions y documentarlo correctamente.
   - Alternativa: migrar a Vercel Cron y agregar la configuración real a `vercel.json`.
5. Documentar dueño, secreto esperado, frecuencia, alerta y procedimiento manual de recuperación.

**Criterios de aceptación**

- README y documento operativo no se contradicen.
- Cada documento histórico tiene una advertencia visible.
- El cron documentado coincide con la infraestructura desplegada.
- Un nuevo desarrollador puede ejecutar local, CI y smoke siguiendo solo documentación vigente.

**Esfuerzo:** 1–2 días.

### FX-09 — Privacidad y SEO de `/pedido`

**Recomendación:** aprobar.

**Trabajo**

- Declarar `noindex`, `nofollow` y referrer restrictivo en toda la familia `/pedido`.
- Mantener `Cache-Control: no-store`.
- Añadir una prueba de metadata/headers.

**Criterios de aceptación**

- `/pedido` y `/pedido/{número}` entregan políticas equivalentes.
- Sitemap no incluye rutas privadas de pedido.
- El cambio no afecta la reclamación de links.

**Esfuerzo:** 0,25–0,5 día.

### FX-10 — Limpieza de tooling

**Recomendación:** aprobar, pero en PR separado.

**Trabajo**

- Excluir `mockup/` del lint operativo o darle configuración separada.
- Resolver warnings reales en código productivo.
- Migrar Vitest a configuración ESM inequívoca.
- Definir cero warnings como objetivo de CI para código productivo.

**Criterios de aceptación**

- Lint termina sin warnings productivos.
- Vitest no emite la advertencia del loader CJS/ESM.
- Unit, typecheck y build siguen verdes.

**Esfuerzo:** 0,5–1 día.

## Mejoras aconsejables

### MJ-01 — DTOs y columnas explícitas

Reemplazar `select('*')` en categorías, cupones, exportaciones y detalle de producto. Definir DTOs diferentes para UI, exportación y mutación.

**Aceptar cuando:** se quiera reducir acoplamiento al esquema y evitar que columnas nuevas viajen al cliente automáticamente.  
**Esfuerzo:** 1–2 días.

### MJ-02 — Observabilidad comercial

Agregar métricas y alertas para:

- webhook rechazado o sin configuración;
- pago pendiente demasiado tiempo;
- upload preparado pero no finalizado;
- fallo de notificación;
- cron sin ejecuciones dentro de la ventana esperada.

No registrar emails, teléfonos, tokens, comprobantes ni payloads completos. Definir un runbook por alerta y medir primero antes de fijar umbrales estrictos.

**Aceptar cuando:** se quiera detectar el problema antes de que lo reporte un cliente.  
**Esfuerzo:** 1–3 días, según la herramienta elegida.

### MJ-03 — Revisión visual del panel autenticado

Crear un usuario local de auditoría, sembrar datos representativos y recorrer desktop/mobile/dark del panel completo. Añadir screenshots de regresión solo para superficies estables: navegación, tablero, inventario, pedidos y diálogos principales.

**Aceptar cuando:** se pueda reservar una iteración visual sin mezclarla con lógica comercial.  
**Esfuerzo:** 1–2 días de auditoría inicial; los fixes resultantes se estiman aparte.

## Sugerencias opcionales

### OP-01 — CSP progresiva sin `unsafe-inline`

Primero desplegar `Content-Security-Policy-Report-Only`, medir scripts/estilos bloqueados y después migrar a nonce/hashes. No conviene cambiar CSP junto con pagos porque podría bloquear checkout o analytics y complicar el diagnóstico.

**Esfuerzo:** 2–4 días más una ventana de observación.  
**Decisión sugerida:** posponer hasta cerrar la base recomendada.

### OP-02 — Refactor incremental de componentes grandes

No hacer una reescritura transversal. Al tocar un módulo, extraer límites por capacidad:

- lectura/mutaciones;
- filtros y estado de URL;
- tabla/lista;
- formulario;
- diálogos;
- presentación pura.

Empezar por `Catalogo`, `CheckoutPedido`, `Pedidos` o `Inventario` solo cuando exista una necesidad funcional en ese módulo. Cada refactor debe mantener comportamiento y tener tests antes de mover código.

**Esfuerzo:** 2–5 días por módulo.  
**Decisión sugerida:** backlog oportunista.

### OP-03 — Umbrales de escalabilidad del catálogo

No migrar hoy por intuición. Definir alertas para actuar cuando ocurra cualquiera de estos eventos:

- más de 300–500 SKUs visibles;
- ruta de catálogo por encima del presupuesto de transferencia acordado;
- interacción/filtro perceptiblemente lento en móviles reales;
- consulta pública con latencia p95 fuera del objetivo.

Al activarse, mover búsqueda, filtros y paginación a servidor/RPC con DTO compacto y conservar URLs compartibles.

**Decisión sugerida:** aceptar el monitoreo, posponer la migración.

### OP-04 — Sistema de diseño compartido

Centralizar tokens semánticos —superficie, texto principal/secundario, marca, éxito, advertencia, peligro, foco— para catálogo, tracking y panel. Mantener las tipografías y personalidad editorial del catálogo; el objetivo es coherencia y accesibilidad, no uniformar todas las pantallas.

Agregar una página interna de estados/componentes o snapshots antes de incorporar una herramienta más pesada.

**Esfuerzo:** 2–4 días iniciales.  
**Decisión sugerida:** combinar con FX-04 y luego extender gradualmente.

### OP-05 — Ajustes visuales menores de mobile

- Resumir o rotar el segundo mensaje de la barra de anuncio en vez de ocultarlo.
- Llevar acciones frecuentes a targets de aproximadamente 44 px.
- Revisar el sello de 7 px como elemento decorativo o aumentar su lectura.
- Validar textos a 200 % de zoom y con fuentes del sistema ampliadas.

**Esfuerzo:** 1–2 días si se agrupa con FX-04.  
**Decisión sugerida:** incluir los cambios sin impacto de marca; someter la barra de anuncio a aprobación visual.

## Estrategia de implementación y releases

### PR 1 — Quick hardening

- FX-01 webhook fail-closed.
- FX-05 retiro de emails personales.
- FX-07 passkeys contenidas.
- FX-09 metadata de pedido.

**Gate:** lint, unit, typecheck, Edge test de webhook, build, smoke.

### PR 2 — Comprobantes

- FX-02 completo.
- Migración/RPC si corresponde.
- Tests de Storage, límites y cleanup.

**Gate:** reset de Supabase desde cero, advisors, RLS matrix, integración y E2E con archivos de prueba.

### PR 3 — Notificaciones y seguimiento

- FX-03 completo.
- Migración de capacidades si corresponde.
- Documentación de proveedor y recuperación.

**Gate:** apertura cross-device, vencimiento, retries e idempotencia.

### PR 4 — Accesibilidad pública

- FX-04 y, si se aprueba, OP-05.
- Rehabilitación de contraste Axe.

**Gate:** Axe AA, teclado, responsive, dark/light y comparación visual.

### PR 5 — Cobertura y operación

- FX-06, FX-08, FX-10.
- MJ-02 si se aprueba.

**Gate:** CI desde cero, smoke y runbooks actualizados.

### PR posteriores

MJ-01 y opcionales, uno por objetivo. No mezclarlos con correcciones urgentes.

## Definition of Done global

Un paquete solo se considera terminado cuando:

- tiene criterios de aceptación automatizados cuando sea razonable;
- no debilita RLS, grants, bucket privado ni separación de `service_role`;
- pasa lint, unit, typecheck, build y smoke;
- si toca Supabase, pasa reset local, advisors, matriz RLS e integración;
- si toca UI, pasa teclado, Axe, responsive y dark/light;
- tiene rollback documentado;
- actualiza README/runbook/env de ejemplo si cambia operación;
- no deja warnings nuevos ni tests deshabilitados sin justificación;
- fue verificado en preview antes de producción.

## Registro de decisiones

| Decisión | Recomendación | Elección final |
| --- | --- | --- |
| Estrategia de comprobantes | Upload directo firmado | **Aprobado: upload directo** |
| Canal automático de pedidos | Email + WhatsApp opcional/manual | **Aprobado: 2A** |
| Tipo de link de seguimiento | Capacidad corta, revocable y hasheada | **Aprobado: 3A** |
| Passkeys históricas | Eliminar código desplegable; rediseñar desde cero si vuelven | **Aprobado: eliminar** |
| Ejecutor del cron | Mantener GitHub Actions si está estable y corregir docs | Pendiente |
| Cambios visuales mobile | Accesibilidad + comodidad sin rediseño amplio | **Aprobado: 5B** |
| Barra de anuncio mobile | Mantener actual o aprobar mensaje combinado por separado | Pendiente; fuera de 5B |
| Refactor de componentes | Oportunista, no big-bang | Pendiente |
| Paginación de catálogo | Posponer; definir umbrales ahora | Pendiente |
| CSP estricta | Report-only después de los fixes comerciales | Pendiente |

## Opciones evaluadas y decisiones tomadas

### Decisión 2 — ¿Cómo avisar al cliente sobre su pedido?

Esta decisión define qué mensaje sale automáticamente cuando se crea un pedido o cambia de estado.

| Opción | Cómo funciona | Ventaja | Costo/limitación |
| --- | --- | --- | --- |
| **2A — Email automático + botón de WhatsApp** | La app envía email automáticamente. WhatsApp queda como botón para que cliente o negocio continúen la conversación. | Buen equilibrio entre automatización, costo y experiencia. | Requiere configurar y monitorear un proveedor de email. |
| 2B — Solo email automático | Todas las novedades llegan por email. | Es la alternativa más simple de automatizar. | Algunos clientes revisan poco el email. |
| 2C — Solo WhatsApp manual | La app no envía nada sola; muestra un botón que abre WhatsApp con un texto preparado. | No requiere API ni costo de mensajería. | Depende de que una persona o el cliente pulse el botón; no es una notificación automática. |
| 2D — WhatsApp automático | La app envía mensajes mediante WhatsApp Business API. | Mayor visibilidad para el cliente. | Requiere cuenta Business/API, plantillas aprobadas, configuración y costo por conversación. |
| 2E — Sin notificaciones | El cliente consulta el estado únicamente desde la web. | Cero integración externa. | Peor experiencia y más consultas manuales. |

**Decisión tomada el 23/08/2026:** **2A**, email automático más WhatsApp opcional/manual. No obliga a pagar ni mantener la API automática de WhatsApp y conserva un canal directo con el negocio.

### Decisión 3 — ¿Cómo hacer que el link funcione en otro celular o navegador?

Hoy el seguimiento depende de una cookie creada en el navegador original. La decisión define cómo autorizar de forma segura un dispositivo nuevo.

| Opción | Cómo funciona | Seguridad/experiencia |
| --- | --- | --- |
| **3A — Link seguro temporal** | El email o WhatsApp lleva una clave aleatoria de corta duración. Al abrirla, la app valida la clave, crea la cookie segura y limpia el token de la URL. Puede revocarse. | **Recomendada:** un clic para el cliente y buen nivel de seguridad. |
| 3B — Código de verificación | El cliente escribe número de pedido y recibe un código por email/WhatsApp. | Muy seguro, pero agrega pasos y depende igualmente de un canal de mensajes. |
| 3C — Solo navegador original | Se conserva el comportamiento actual basado en cookie. | Menos trabajo, pero el enlace falla al cambiar de equipo o borrar cookies. |
| 3D — Token permanente en la URL | El mismo link funciona siempre. | Fácil de implementar, pero no recomendado: puede filtrarse, reenviarse o quedar en historial. |

**Decisión tomada el 23/08/2026:** **3A**, link temporal, revocable y guardado únicamente como hash. Se combinará con el email automático de 2A y podrá incluirse en el texto preparado de WhatsApp opcional.

### Decisión 5 — ¿Cuánto cambiar visualmente el catálogo móvil?

El contraste y el acceso por teclado son correcciones necesarias. Lo opcional es hasta dónde mejorar comodidad y contenido sin alterar la estética.

| Opción | Incluye | Efecto visual |
| --- | --- | --- |
| 5A — Solo accesibilidad necesaria | Contraste AA, galería por teclado/foco y correcciones imprescindibles de texto ilegible. | Cambio mínimo; conserva casi exactamente la composición actual. |
| **5B — Accesibilidad + comodidad** | Todo 5A, textos secundarios un poco mayores, acciones principales cercanas a 44 px y espaciado ajustado. | **Recomendada:** se nota más cómoda, pero mantiene la identidad y la grilla de dos columnas. |
| 5C — Mejora móvil completa | Todo 5B más rediseño de la barra superior, revisión profunda de cards, filtros y densidad de información. | Mayor cambio visual y requiere una ronda específica de aprobación. |

Para la barra de anuncio, dentro de 5C hay tres variantes:

1. Mantener solo “Envíos en Neuquén”.
2. Mostrar un mensaje combinado: “Envíos en Neuquén · Consultas por WhatsApp”. **Recomendada.**
3. Rotar varios mensajes. Tiene más contenido, pero introduce movimiento y controles adicionales de accesibilidad.

**Decisión tomada el 23/08/2026:** **5B**, accesibilidad más comodidad, manteniendo la identidad y la grilla actual. La barra de anuncio no forma parte de 5B y queda sin cambios salvo decisión posterior.

## Próximo paso propuesto

Las cinco decisiones que definen la base recomendada ya están aprobadas:

1. Upload directo firmado.
2. Email automático más WhatsApp opcional/manual (2A).
3. Link temporal, revocable y hasheado para seguimiento cross-device (3A).
4. Eliminación del código histórico desplegable de passkeys.
5. Accesibilidad más comodidad móvil, sin rediseño amplio (5B).

El próximo paso puede ser convertir estos paquetes en tickets definitivos y comenzar por el PR 1 de quick hardening. La barra de anuncio, cron, CSP, refactors y demás opcionales continúan pendientes y no entran por defecto.
