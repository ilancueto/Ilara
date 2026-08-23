# Auditoría integral de Ilara

**Fecha:** 23 de agosto de 2026  
**Alcance:** aplicación Next.js, catálogo público, panel de gestión, Supabase, pagos, pedidos, seguridad, rendimiento, accesibilidad, experiencia visual, pruebas, CI y documentación.  
**Tipo de revisión:** lectura de código y configuración, compilación de producción, pruebas automatizadas, análisis estático, navegación manual responsive y auditoría Axe. No se modificó lógica de la aplicación.

**Plan de acción asociado:** [Plan propuesto de fixes y mejoras](PLAN_FIXES_Y_MEJORAS_2026-08-23.md).

## Resumen ejecutivo

Ilara tiene una base técnica sólida y una identidad visual pública muy lograda. La aplicación compila en producción, pasa el chequeo de tipos, tiene 216 pruebas unitarias verdes, smoke tests y controles PWA correctos, no presenta vulnerabilidades conocidas en `npm audit`, y la arquitectura de Supabase muestra un trabajo de seguridad superior al promedio: separación de clientes, RLS, RPC, storage privado y lógica sensible del lado servidor.

No encontré un motivo para considerar la aplicación inestable en general, pero sí cuatro problemas de prioridad alta que conviene resolver antes de aumentar el volumen de pedidos o pagos:

1. El sistema promete comprobantes de hasta 5 MB, pero el flujo actual no puede procesarlos de forma confiable: Next.js limita las Server Actions a 1 MB por defecto y Vercel limita el cuerpo de una Function a 4,5 MB.
2. El webhook de Mercado Pago responde `200 OK` cuando falta el access token. Mercado Pago puede considerar el evento entregado aunque la aplicación no haya actualizado el pago.
3. El catálogo tiene incumplimientos reales de contraste WCAG que los tests actuales ocultan al desactivar expresamente la regla `color-contrast`.
4. La notificación inicial del pedido quedó desactivada y varios emails posteriores construyen enlaces de seguimiento sin credencial. Esos enlaces pueden fallar al abrirse en otro navegador o dispositivo.

### Estado por área

| Área | Estado | Lectura rápida |
| --- | --- | --- |
| Arquitectura y tipado | Bueno | Separación clara, TypeScript estricto y build sano; varios componentes crecieron demasiado. |
| Seguridad y datos | Bueno con observaciones | RLS/RPC y credenciales bien resueltas; quedan hardenings y dos riesgos operativos concretos. |
| Pagos y pedidos | Requiere atención | El diseño general es robusto, pero el webhook, los comprobantes y los enlaces de seguimiento necesitan corrección. |
| Catálogo visual | Muy bueno | Identidad editorial coherente, responsive y dark mode cuidados. Hay problemas de legibilidad y contraste. |
| Panel visual | Bueno por código y pruebas | Consistente y funcional; no fue posible recorrerlo manualmente autenticado en esta auditoría local. |
| Accesibilidad | Requiere atención | Buen uso de diálogos y navegación base, pero Axe detecta contraste serio y hay una interacción no accesible por teclado. |
| Rendimiento | Bueno hoy | Carga razonable, imágenes/fuentes optimizadas e ISR; el catálogo completo en cliente escalará de forma lineal. |
| Pruebas y CI | Bueno | Cobertura amplia y CI fuerte; faltan pruebas de ejecución reales para funciones Edge críticas. |
| Documentación | A ordenar | Hay runbooks valiosos, pero también documentos históricos que contradicen el estado actual. |

## Hallazgos priorizados

| ID | Prioridad | Área | Hallazgo | Impacto |
| --- | --- | --- | --- | --- |
| ILR-01 | Alta | Pagos | Límite prometido de 5 MB incompatible con Server Actions y Vercel | Comprobantes válidos pueden fallar antes de llegar a la lógica de negocio. |
| ILR-02 | Alta | Pagos | Webhook responde 200 cuando falta `MERCADOPAGO_ACCESS_TOKEN` | Pérdida silenciosa de actualizaciones de pago y ausencia de reintentos. |
| ILR-03 | Alta | Accesibilidad | Contraste WCAG insuficiente y regla desactivada en tests | Texto difícil de leer y falsa sensación de cobertura automática. |
| ILR-04 | Alta | Pedidos | Notificación inicial desactivada y enlaces posteriores sin token | Clientes sin aviso o con enlaces que no abren fuera del navegador original. |
| ILR-05 | Media | Seguridad/privacidad | Emails personales embebidos en un componente cliente | PII innecesaria en el artefacto frontend y lógica de saludo difícil de mantener. |
| ILR-06 | Media | Pruebas | Flujos Edge críticos se verifican mayormente como texto o con mocks | Una regresión de comportamiento puede pasar aunque el test siga verde. |
| ILR-07 | Media | Uploads | MIME/extensión confiados al cliente y falta de cleanup transaccional | Archivos mal tipados y objetos huérfanos en Storage. |
| ILR-08 | Media | Accesibilidad visual | Galería no operable por teclado y tipografía móvil demasiado pequeña | Menor usabilidad para teclado, baja visión y pantallas pequeñas. |
| ILR-09 | Media | Mantenibilidad | Componentes cliente de 500–864 líneas | Mayor costo de cambios, pruebas y revisiones; más riesgo de regresiones. |
| ILR-10 | Media | Seguridad preventiva | Implementación passkey vulnerable conservada detrás de dos flags independientes | Una reactivación accidental recuperaría superficie insegura. |
| ILR-11 | Media-baja | Documentación/operación | Runbooks y planes contradicen la implementación actual | Despliegues y decisiones operativas basados en información incorrecta. |
| ILR-12 | Media-baja | Seguridad web | CSP mantiene `unsafe-inline` en scripts y estilos | La política mitiga menos ante una futura inyección HTML/JS. |
| ILR-13 | Baja | Rendimiento | Todo el catálogo se entrega al cliente y se pagina allí | Transferencia y memoria crecerán con la cantidad de productos. |
| ILR-14 | Baja | Datos | Uso de `select('*')` en superficies administrativas | Acoplamiento al esquema y riesgo de exponer columnas futuras. |
| ILR-15 | Baja | SEO/privacidad | `/pedido` no declara `noindex`; solo las rutas con número lo hacen | Posible indexación residual o resultados “bloqueados por robots”. |
| ILR-16 | Baja | Tooling | Warnings de lint y configuración Vitest cargada como CJS | Ruido que oculta regresiones reales y futura incompatibilidad del runner. |

## Detalle de los hallazgos

### ILR-01 — El upload de 5 MB no funciona de punta a punta

**Evidencia**

- [`lib/dal/payments.ts`](../lib/dal/payments.ts) acepta archivos de hasta `5 * 1024 * 1024` bytes.
- [`app/actions/payments.ts`](../app/actions/payments.ts) recibe el archivo completo dentro de una Server Action.
- [`next.config.ts`](../next.config.ts) no define `serverActions.bodySizeLimit`.
- La documentación local de Next.js 16 instalada en el proyecto establece un límite por defecto de 1 MB para el cuerpo de una Server Action.
- Vercel limita actualmente el cuerpo de una Function a 4,5 MB: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations#request-body-size).

**Consecuencia**

Un comprobante de más de 1 MB puede ser rechazado por Next.js antes de que se ejecute el mensaje amigable de la aplicación. Incluso elevando el límite de Next, un archivo cercano a 5 MB más el overhead del multipart excede Vercel.

**Recomendación**

Usar upload directo a Supabase Storage mediante una capacidad o URL firmada de corta duración y completar luego el RPC con path, hash y metadatos. Como solución intermedia, reducir explícitamente el máximo de interfaz/servidor a un valor seguro inferior al límite de plataforma y configurar el límite de Next de forma coherente. Añadir una prueba E2E con archivos justo por debajo y por encima del límite real.

### ILR-02 — El webhook de Mercado Pago falla abierto ante mala configuración

**Evidencia**

En [`supabase/functions/payments-mp-webhook/index.ts`](../supabase/functions/payments-mp-webhook/index.ts), si `MERCADOPAGO_ACCESS_TOKEN` tiene menos de 16 caracteres, la función responde `200` con `{ ok: true }`.

**Consecuencia**

Una variable ausente o mal cargada convierte una incidencia de configuración en pérdida silenciosa de eventos. El emisor puede no reintentar porque recibió éxito.

**Recomendación**

Responder `500` o `503`, registrar un evento estructurado sin secretos y disparar una alerta. Agregar un test de ejecución de la Edge Function que demuestre que una configuración incompleta nunca devuelve éxito.

### ILR-03 — Contraste insuficiente oculto por la suite Axe

**Evidencia**

Una ejecución de Axe con WCAG 2 A/AA y contraste habilitado dio:

- Catálogo desktop claro: 1 violación seria, 23 nodos.
- Catálogo móvil claro: 1 violación seria, 20 nodos.
- Catálogo móvil oscuro: 1 violación seria, 33 nodos.
- Login móvil: sin violaciones.

Ejemplos observados:

- Rosa `#b85d6f` sobre `#faf8f5`: relación aproximada 4,09:1 frente a 4,5:1 requerida para texto normal.
- Texto gris sobre la nota rosa del hero: aproximadamente 1,73:1.
- Precio por transferencia oscuro `#6b5b63` sobre `#130f12`: aproximadamente 2,98:1.
- Contadores activos y categorías rosas con contraste inferior al requerido.

La suite desactiva la regla en [`e2e/a11y.spec.ts`](../e2e/a11y.spec.ts) y en otros seis archivos E2E. Los estilos implicados están en [`components/Catalogo/CatalogoEditorial.module.css`](../components/Catalogo/CatalogoEditorial.module.css) y [`components/Catalogo/CatalogPrice.module.css`](../components/Catalogo/CatalogPrice.module.css).

**Recomendación**

Crear tokens de texto/estado que alcancen AA en claro y oscuro, corregir primero textos menores y elementos activos, y volver a habilitar `color-contrast` en CI. Si un componente decorativo requiere excepción, limitarla a ese nodo con justificación en vez de desactivar la regla para toda la página.

### ILR-04 — Flujo de notificaciones y seguimiento incompleto

**Evidencia**

- [`app/actions/orders.ts`](../app/actions/orders.ts) importa `notifyOrderCustomer`, pero al crear un pedido fija siempre `notifiedVia = 'none'`; el argumento `_notify` queda sin usar.
- La misma acción envía cambios de estado sin pasar un `followToken`.
- [`lib/domain/orders/sendOrderEmail.ts`](../lib/domain/orders/sendOrderEmail.ts) construye `/pedido/{número}` sin token cuando este no está disponible.
- La vista de seguimiento exige un token recibido por URL o una cookie HTTP-only ya creada en ese navegador.
- [`.env.example`](../.env.example) afirma que se envía aviso por email con fallback a WhatsApp, lo que no coincide con la implementación actual.

**Consecuencia**

La creación del pedido puede no generar aviso. Un email de estado abierto en otro dispositivo puede conducir a una pantalla que no puede autorizar el seguimiento.

**Recomendación**

Definir un único contrato de notificación. Para enlaces posteriores, usar una capacidad firmada y revocable de corta duración o un flujo seguro de “reclamar seguimiento”; no almacenar ni reenviar en claro el token largo original. Añadir pruebas de apertura en un contexto de navegador limpio.

### ILR-05 — Emails personales en código cliente

[`app/home-page-client.tsx`](../app/home-page-client.tsx) contiene dos direcciones personales para elegir el saludo del usuario.

Aunque la pantalla esté protegida, esos valores forman parte del código frontend y no son necesarios para la función. El saludo debería provenir de `user_metadata`, perfil o una propiedad preparada en servidor. Esto elimina PII del bundle y evita editar código para incorporar otra cuenta.

### ILR-06 — Las integraciones de mayor riesgo no se ejecutan realmente en tests

Hay buena amplitud de pruebas, pero 23 archivos usan `readFileSync` para validar que el código fuente contenga determinados patrones. Esto sirve como guardrail, no como prueba de comportamiento. Los flujos de Mercado Pago, shipping, webhook y refund dependen en gran medida de estas aserciones o de mocks.

**Recomendación**

Ejecutar las funciones Deno localmente con Supabase CLI y servidores fake deterministas para Mercado Pago, shipping y email. Cubrir firma inválida, secreto faltante, timeout, reintento, idempotencia y respuesta parcial. Mantener las pruebas de texto solo como complemento.

### ILR-07 — Validación y ciclo de vida del comprobante

[`lib/dal/payments.ts`](../lib/dal/payments.ts) determina extensión y `contentType` desde `file.type`/nombre y no inspecciona magic bytes. Si Storage acepta el archivo pero el RPC de finalización falla, no se elimina el objeto recién subido.

**Recomendación**

- Validar firma real para JPEG, PNG, WebP y PDF.
- Normalizar MIME y extensión en servidor.
- Eliminar el objeto si falla `complete_transfer_receipt*`.
- Incorporar un job de reconciliación para objetos preparados pero nunca completados.

### ILR-08 — Interacción de galería y legibilidad móvil

En [`components/Catalogo.tsx`](../components/Catalogo.tsx), el contenedor visual del producto es un `div` con `onClick`, sin rol, `tabIndex` ni control de teclado. Un usuario puede navegar al producto por el enlace, pero no abrir esa galería de imágenes con teclado.

En mobile se observan nombres y precios de 12 px, categorías de 9 px, sello del hero de 7 px y precio de transferencia de aproximadamente 9,4 px. La composición a dos columnas se ve elegante, pero sacrifica lectura y escaneo.

**Recomendación**

Convertir la acción de preview en un `button` accesible o agregar semántica y `Enter`/`Space`. Elevar textos informativos a 12–14 px efectivos, revisar el sello decorativo y probar el catálogo a 320, 360 y 390 px con zoom al 200 %.

### ILR-09 — Componentes demasiado grandes

Los mayores componentes TSX tienen entre 522 y 864 líneas:

| Componente | Líneas aproximadas |
| --- | ---: |
| `Tablero.tsx` | 864 |
| `Inventario/Inventario.tsx` | 863 |
| `Pedidos.tsx` | 835 |
| `Catalogo.tsx` | 799 |
| `Catalogo/CheckoutPedido.tsx` | 784 |
| `Clientes.tsx` | 773 |
| `Devoluciones.tsx` | 676 |
| `HistorialVentas.tsx` | 671 |

**Recomendación**

Separar por capacidades y no solo por fragmentos visuales: queries/mutaciones, estado de filtros, tablas/listas, formularios y diálogos. Mantener los límites de error y carga cerca de cada bloque. El objetivo no es reducir líneas por sí mismo, sino aislar cambios y permitir pruebas específicas.

### ILR-10 — Contención de passkeys duplicada

La Edge Function [`supabase/functions/passkey-auth/index.ts`](../supabase/functions/passkey-auth/index.ts) está correctamente bloqueada con respuesta 403. Sin embargo, conserva debajo toda la implementación histórica y declara su propio `PASSKEYS_CONTAINED`, independiente del flag en [`lib/security/passkeysContainment.ts`](../lib/security/passkeysContainment.ts).

**Recomendación**

Dejar la función desplegada como un handler mínimo que responda 403 y mover/eliminar el código histórico. Si se retoman passkeys, implementarlas en una función nueva, con revisión de origen, sesión, challenges y rate limiting probados. Evitar que un cambio de un booleano reactive una superficie conocida como insegura.

### ILR-11 — Documentación contradictoria

Ejemplos concretos:

- [`docs/TODO_PROYECTO.md`](TODO_PROYECTO.md) declara catálogo offline completado, mientras que README y service worker definen correctamente una PWA online-only.
- Los documentos de Etapa 8 hablan de Vercel Cron, pero [`vercel.json`](../vercel.json) no configura crons; la ejecución real está en [`.github/workflows/expire-catalog-payments.yml`](../.github/workflows/expire-catalog-payments.yml).
- [`README.md`](../README.md) declara Node `>=20.9`; CI ya usa Node 22 y el soporte actual de dependencias aconseja unificar el requisito en Node 22.
- Documentos históricos todavía mencionan Serwist y estados “pendientes” de funciones ya implementadas.

**Recomendación**

Marcar documentos históricos como archivados, mantener un único `ESTADO_ACTUAL.md` o README operativo, y hacer que cada runbook indique dueño y fecha de última validación. Corregir de inmediato cron, PWA, Node y contrato de notificaciones.

### ILR-12 — CSP todavía permite inline

[`next.config.ts`](../next.config.ts) quita `unsafe-eval` en producción, lo cual es positivo, pero mantiene `script-src 'unsafe-inline'` y `style-src 'unsafe-inline'`.

No encontré una inyección activa y el JSON-LD tiene serialización defensiva, por lo que esto es hardening, no una vulnerabilidad confirmada. Como evolución, usar nonce/hashes para scripts y desplegar primero una política `Content-Security-Policy-Report-Only` para medir incompatibilidades.

### ILR-13 — Escalabilidad del catálogo

La página obtiene el snapshot completo de productos, combos y categorías y pagina 15 elementos en cliente. Con los 76 productos actuales es razonable y el peso inicial medido localmente fue cercano a 0,57 MB transferidos. El costo crecerá linealmente al incorporar productos e imágenes.

Definir un umbral —por ejemplo, varios cientos de SKUs— para migrar búsqueda, filtros y paginación a servidor/RPC con DTO compacto. Antes de ese punto, no parece una optimización urgente.

### ILR-14 — Selecciones amplias en administración

`GestionCategorias`, `GestionCupones`, `ExportarDatos` y `Inventario/DetalleProducto` usan `select('*')`. Son superficies autenticadas y RLS reduce el riesgo actual, pero una nueva columna sensible quedaría incluida sin que el consumidor la haya solicitado.

Usar listas explícitas de columnas y DTOs, especialmente para exportaciones y datos que atraviesan componentes cliente.

### ILR-15 — Metadatos de `/pedido`

[`app/pedido/page.tsx`](../app/pedido/page.tsx) no exporta `metadata` con `robots: noindex`, mientras que las páginas con número de pedido sí lo hacen. `robots.txt` no reemplaza el `noindex` y, si bloquea el rastreo, puede impedir que el crawler vea esa instrucción.

Añadir `noindex`, `nofollow` y `referrer: no-referrer` de forma consistente a toda la familia de rutas de pedido.

### ILR-16 — Ruido de tooling

- `npm run lint` termina sin errores, pero emite 29 warnings. La mayoría provienen de `mockup/`, y uno real es el argumento `_notify` sin uso.
- Vitest avisa que la configuración ESM se está cargando como CJS y que el loader nativo futuro dejará de admitirla.

Excluir prototipos del lint principal o darles una configuración separada, dejar el lint operativo en cero warnings y migrar la configuración Vitest a un formato ESM inequívoco.

## Auditoría visual

### Catálogo público

**Lo mejor**

- Identidad editorial reconocible y consistente; la combinación de Fraunces, Outfit y Great Vibes funciona bien para la marca.
- Muy buena jerarquía entre anuncio, navegación, hero, filtros y grilla.
- Fotografía, radios, sombras y color tienen un lenguaje común.
- Responsive fluido en 1440×900 y 390×844; filtro, bolsa y checkout se adaptan sin desbordes observados.
- Dark mode visualmente coherente, no una simple inversión de colores.
- Estados vacíos, modales y checkout conservan el tono de la marca.

**A mejorar**

- Corregir contraste en textos rosas, grises y estados activos.
- Subir tamaño/line-height de metadatos y precios secundarios en mobile.
- En móvil, el anuncio oculta por completo el mensaje secundario y deja solo “Envíos en Neuquén”; conviene rotarlo, resumirlo o dejar un acceso claro a WhatsApp.
- Dar un estado de foco visible y semántica de botón a la apertura de imágenes.
- Revisar targets táctiles de 34–38 px. Cumplen el mínimo técnico de WCAG 2.2 de 24 px, pero 44 px sería más cómodo.

### Login

El login es limpio, consistente y sin violaciones Axe detectadas en la revisión móvil, incluido contraste. La jerarquía y los estados de formulario resultan claros.

### Checkout y seguimiento

El checkout móvil está bien resuelto: pasos comprensibles, resumen legible y diálogo de bolsa correcto. El mayor riesgo no es visual sino operativo: servicios externos de shipping y el flujo de autorización/notificación deben probarse de punta a punta.

### Panel autenticado

La revisión de código y los E2E muestran un sistema visual pastel consistente, soporte dark, formularios y diálogos con patrones compartidos. Sin credenciales/local users activos no se realizó una inspección manual completa del panel autenticado, por lo que no corresponde afirmar una validación visual exhaustiva de cada dashboard. Esta es la principal limitación visual del informe.

Como mejora de sistema de diseño, conviene centralizar más colores arbitrarios y variantes repetidas en tokens/componentes. Hoy el catálogo tiene CSS Modules muy cuidado y el panel mezcla utilidades Tailwind con valores hexadecimales específicos; ambos se ven coherentes, pero mantenerlos sincronizados será más costoso a medida que crezca el producto.

## Rendimiento y arquitectura

### Aspectos positivos

- Uso de `next/image`, `sizes`, prioridad para LCP y hosts remotos acotados.
- Fuentes locales mediante `next/font`.
- ISR para catálogo y fichas, además de generación estática de productos.
- Fetches de datos públicos paralelos y DTOs acotados en las rutas principales.
- Imports dinámicos en la home/panel para áreas pesadas.
- Build de producción sano con Next.js 16.3.0 y React Compiler.

### Mediciones orientativas locales

- Catálogo, primera carga de producción local: ~0,57 MB transferidos.
- JavaScript comprimido aproximado: ~271 KB.
- Imágenes iniciales aproximadas: ~70 KB.
- Fuentes principales aproximadas: ~112 KB.

Estas cifras no indican un problema urgente. Deben tomarse como línea base local, no como Web Vitals reales de usuarios; para decisiones de rendimiento conviene usar Vercel Speed Insights/RUM y presupuestos por ruta.

## Seguridad y datos: fortalezas encontradas

- Clientes Supabase separados para browser, acceso público, servidor autenticado y service role.
- Uso de `server-only` en módulos sensibles y ausencia de service role en componentes cliente.
- RLS, grants explícitos, RPCs y funciones `security definer` con `search_path` controlado en migraciones recientes.
- Pedidos, precios, pagos e idempotencia resueltos de forma autoritativa en backend.
- Storage privado para comprobantes y URLs firmadas para lectura.
- Webhook con verificación HMAC y ventana temporal; el problema es el manejo de configuración ausente, no la firma.
- Headers de seguridad, `X-Frame-Options: DENY`, `nosniff`, política de permisos y CSP.
- Serialización defensiva de JSON-LD.
- CI con tests de RLS, advisors, drift de tipos, negative controls, integración y E2E.
- `npm audit`: 0 vulnerabilidades conocidas al momento de la auditoría.

## Verificaciones ejecutadas

| Comando/revisión | Resultado |
| --- | --- |
| `npm run lint` | Pasa; 0 errores y 29 warnings. |
| `npm test` | 41 archivos, 216 tests verdes. |
| `npm run build` | Build de producción y TypeScript verdes; 87 páginas estáticas generadas. |
| `npm run test:integration` | 18 tests verdes y 85 omitidos por no estar habilitado el entorno local completo. CI sí contiene el setup. |
| Playwright público `e2e/a11y.spec.ts` | 4 tests verdes; contraste estaba deshabilitado. |
| Axe adicional con contraste | Violaciones serias en catálogo claro/oscuro; login sin violaciones. |
| `npm run test:smoke` sobre producción local | 16/16 controles verdes. |
| `npm run check:pwa-icons` | Iconos, manifest y service worker online-only verdes. |
| `npm audit --json` | 0 vulnerabilidades. |
| Revisión responsive manual | Catálogo, filtros, bolsa, checkout, login y dark mode. |
| Revisión CI/Supabase | Workflows, migraciones, RLS, funciones Edge y política de secrets. |

## Límites de esta auditoría

- No se ejecutaron pagos reales, reembolsos, emails ni cotizaciones de shipping contra proveedores productivos.
- No se mutaron datos de producción ni se usaron secretos productivos.
- El panel autenticado no se recorrió manualmente por falta de una sesión de prueba local lista; sí se revisó código y cobertura E2E.
- Los 85 tests de integración omitidos no representan fallos, pero reducen la evidencia obtenida en esta máquina.
- Las métricas de peso/tiempo son locales y no reemplazan RUM o Core Web Vitals de producción.

## Plan de acción recomendado

### Primer bloque — proteger ventas y atención al cliente

1. Rediseñar el upload de comprobantes o reducir el límite real de punta a punta.
2. Hacer fallar de forma explícita el webhook sin token y agregar alerta/test ejecutable.
3. Restaurar el aviso inicial y diseñar enlaces de seguimiento seguros que funcionen cross-device.
4. Corregir los contrastes públicos y reactivar la regla Axe en CI.
5. Quitar emails personales del componente cliente.

### Segundo bloque — cerrar calidad operativa

1. Añadir contract tests reales para Edge Functions y proveedores externos.
2. Validar magic bytes y cleanup de Storage.
3. Hacer accesible por teclado la galería y ajustar tipografía móvil.
4. Consolidar documentación de cron, PWA, Node y notificaciones.
5. Simplificar la función passkey contenida.

### Tercer bloque — reducir costo futuro

1. Dividir los componentes mayores por capacidades.
2. Centralizar tokens visuales entre catálogo, tracking y panel.
3. Reemplazar `select('*')` por DTOs explícitos.
4. Preparar paginación/búsqueda de servidor al alcanzar el umbral de catálogo definido.
5. Limpiar warnings de tooling y añadir presupuestos de bundle/Web Vitals.

## Conclusión

La aplicación no necesita una reescritura. El producto ya tiene una buena estructura, un frente visual distintivo y controles de seguridad serios. El mejor retorno ahora está en corregir cuatro bordes concretos del flujo comercial —comprobantes, webhook, accesibilidad y seguimiento— y después reducir deuda de mantenimiento. Con ese primer bloque resuelto, la base queda en una posición muy buena para crecer sin perder confiabilidad ni calidad visual.
