# Revisión del catálogo y panel Ilara — 5 de septiembre de 2026

Actualización: las correcciones locales y sus verificaciones están en [CORRECCIONES_2026-09-05.md](CORRECCIONES_2026-09-05.md). Este informe conserva el diagnóstico anterior a esos cambios.

Revisión del checkout local `5bd6d31` y de la superficie pública de https://ilara.com.ar. Este informe aporta evidencia nueva; los estados de despliegue que figuran en documentos anteriores no se consideran revalidados por esta revisión.

## Diagnóstico

Ilara ya tiene una base funcional amplia: catálogo, fichas, carrito, pedidos, transferencia y Mercado Pago, cotización de envíos, POS, clientes, cupones, inventario, alertas, devoluciones, márgenes y cuentas/caja. La siguiente inversión debería concentrarse en cerrar diferencias entre esos módulos y mejorar el recorrido de compra y la operación diaria.

La identidad visual del catálogo está definida: tonos suaves, fotografías, tipografía editorial y precios legibles. La ficha utiliza otra composición, terminología y botones. Conviene unificar la experiencia manteniendo la identidad existente.

No hace falta reescribir la aplicación. Hay separación de dominios, DTO públicos sin costos internos, clientes Supabase diferenciados, RPC transaccionales en operaciones importantes y una CI con pruebas de base de datos y navegador. Los defectos encontrados muestran dónde completar esa arquitectura.

## Alcance y validación

| Comprobación ejecutada | Resultado |
|---|---|
| `npm run test` | 43 archivos y 220 pruebas aprobados |
| `npm run lint` | 0 errores; 28 advertencias en `mockup/scripts` |
| `npx tsc --noEmit --incremental false` | Aprobado |
| `npm run build` | Aprobado; 72 páginas generadas; catálogo con revalidación de 1 minuto y fichas de 2 minutos |
| Navegación pública | Catálogo → ficha → agregar a bolsa → abrir bolsa |
| Vista móvil | Catálogo, ficha y bolsa a 390 × 844; ancho de documento 390 en las mediciones de catálogo y bolsa |
| Errores del navegador | Sin errores registrados al consultar durante el recorrido de la ficha |
| Cabeceras de `/pedido` | HTTP 200, `no-store`; `Referrer-Policy: strict-origin-when-cross-origin` |

Se revisaron código del panel, dominios, acciones del servidor, configuración, migraciones seleccionadas, pruebas y documentación. No se inició sesión en el panel ni se ejecutó una venta, pedido, pago, devolución, correo o cambio de stock. No se ejecutaron la suite E2E completa, las integraciones con Supabase local, advisors remotos ni auditoría actual de dependencias. El build usa la configuración existente y lee datos públicos durante el prerenderizado. No se desplegó ni se modificó código funcional.

Las pruebas unitarias incluyen tanto comportamiento como verificaciones de texto de archivos SQL/TS. Que pasen no demuestra por sí solo el comportamiento transaccional de la base ni que producción tenga todas las migraciones aplicadas.

## Correcciones prioritarias

### 1. Alta: proteger la acción que envía notificaciones de estado

**Evidencia:** [orders.ts](C:/Users/ilaan/ilara-app/app/actions/orders.ts:83), [sendOrderEmail.ts](C:/Users/ilaan/ilara-app/lib/domain/orders/sendOrderEmail.ts:31).

`notifyOrderStatusAction(orderNumber, status)` no exige sesión/admin. Convierte el estado recibido en un tipo de aviso y llama a un helper que utiliza `service_role`. Ese helper busca el pedido por número, sin leer su estado real, genera un enlace y envía el correo al cliente registrado.

**Impacto:** una invocación no autorizada puede solicitar avisos falsos de cancelación, preparación o entrega para un número conocido. La clave de idempotencia del proveedor limita algunas repeticiones, pero no autoriza la operación ni verifica su veracidad. Hallazgo confirmado por código; no se ejecutó el envío para comprobarlo en producción. Su efecto externo depende de la configuración de correo.

**Implementación:** exigir `requireAdmin()` antes de usar privilegios; obtener el estado desde la base; enviar a partir de un evento de transición persistido. Consultar las líneas reales del pedido, también en creación, en lugar de aceptar `_notify.lines` del navegador como contenido del correo.

**Aceptación:** un visitante y una cuenta sin rol no pueden generar enlaces ni correos; una transición válida envía el estado y artículos persistidos; repetir el evento no produce avisos adicionales. Next.js exige comprobar autorización dentro de las acciones del servidor: [documentación oficial](https://nextjs.org/docs/app/guides/authentication).

### 2. Alta: guardar combos en una transacción

**Evidencia:** [FormularioCombo.tsx](C:/Users/ilaan/ilara-app/components/Inventario/FormularioCombo.tsx:117).

Al editar, se actualiza `combos`, se eliminan sus componentes y luego se insertan los nuevos en solicitudes separadas. Además, se ignora el error de la eliminación. Si la inserción falla, puede quedar el precio nuevo con una composición vacía o anterior. En creación también puede quedar un combo sin componentes.

**Implementación:** RPC autorizada que valide precio, cantidades y productos, y guarde cabecera y componentes en una sola transacción. Bloquear la fila al editar y definir cómo resolver dos ediciones simultáneas.

**Aceptación:** un componente inválido revierte todo; una edición fallida conserva íntegro el combo anterior; dos administradores no mezclan componentes.

### 3. Alta comercial: completar el checkout desde las fichas

**Evidencia:** [ProductPublicDetailClient.tsx](C:/Users/ilaan/ilara-app/components/product/ProductPublicDetailClient.tsx:635), [ModalCarrito.tsx](C:/Users/ilaan/ilara-app/components/Catalogo/ModalCarrito.tsx:244). Reproducido en la ficha pública `/catalogo/p/86`.

El catálogo pasa `onCheckout` a la bolsa. La ficha no lo pasa: después de agregar un producto, su bolsa solo ofrece **Pedir por WhatsApp**. Quien llega por un enlace compartido no encuentra allí el recorrido de pedido y pago implementado en el catálogo.

**Implementación:** compartir carrito y checkout entre grilla y fichas. Mantener WhatsApp como consulta o canal alternativo, con una acción principal de confirmar pedido consistente.

**Aceptación:** desde un enlace directo se puede agregar, elegir entrega, crear el pedido y continuar al pago; ir y volver entre ficha y grilla conserva cantidades, cupón y precios. Verificar en entorno aislado.

### 4. Alta comercial: alinear envío anunciado, ficha y checkout

**Evidencia:** [ProductPublicDetailClient.tsx](C:/Users/ilaan/ilara-app/components/product/ProductPublicDetailClient.tsx:538), [productStructuredData.ts](C:/Users/ilaan/ilara-app/lib/productStructuredData.ts:47), [CheckoutPedido.tsx](C:/Users/ilaan/ilara-app/components/Catalogo/CheckoutPedido.tsx:80).

La ficha dice envío sin cargo; los datos estructurados declaran tarifa cero para Argentina. El checkout dispone de cotización de envío que se suma al pedido. Las superficies no expresan las mismas condiciones.

**Implementación:** centralizar condiciones comerciales y mostrar “Envío calculado según destino” salvo que exista una regla real de gratuidad. Los datos estructurados deben representar esa misma regla. Publicar condiciones de entrega, retiro y cambios claras y accesibles. Este informe no evalúa validez legal de esas condiciones.

**Aceptación:** ficha, bolsa, cotización y resumen final no se contradicen para retiro, envío y entrega coordinada.

### 5. Media: reconciliar toda la bolsa con datos actuales

**Evidencia:** [useCarrito.ts](C:/Users/ilaan/ilara-app/hooks/useCarrito.ts:81), [useCarrito.ts](C:/Users/ilaan/ilara-app/hooks/useCarrito.ts:151), [Catalogo.tsx](C:/Users/ilaan/ilara-app/components/Catalogo.tsx:119).

Los productos se refrescan con datos del catálogo, pero los combos almacenados se conservan sin actualizar precio o componentes. Las cantidades de combos no tienen límite de stock en el hook. Tampoco se descuenta, en la validación de la bolsa, el consumo compartido entre un producto suelto y los combos que lo contienen. La reconciliación se omite si la lista de productos queda vacía.

**Impacto:** la bolsa puede mostrar importes antiguos o cantidades que el backend posteriormente rechace. No se afirma que esto permita saltarse la validación autoritativa de stock/pago.

**Implementación:** persistir identificadores y cantidades, validar el formato almacenado y resolver entidades actuales al recuperar la bolsa. Sumar demanda por producto considerando combos. Informar cambios de precio/cantidad antes de confirmar. Manejar fallos de `localStorage`; las escrituras actuales no están protegidas y la lectura solo hace un cast del JSON.

**Aceptación:** precio de combo modificado, producto retirado, último producto agotado, stock compartido y almacenamiento no disponible se resuelven sin romper la página ni presentar un total engañoso.

### 6. Media: ordenar la lista completa del catálogo

**Evidencia:** [useCatalogDerivedLists.ts](C:/Users/ilaan/ilara-app/hooks/useCatalogDerivedLists.ts:111).

Se ordenan productos y combos por separado y después se concatenan todos los combos primero. “Precio: menor a mayor”, “Nombre” y “Más nuevo primero” no ordenan globalmente cuando hay ambos tipos. Los combos usan `sale_price` para filtrar/ordenar, mientras la interfaz dispone de un helper de precio mostrado.

**Implementación:** lista discriminada de productos y combos con precio mostrado, nombre y fecha normalizados; filtrar y ordenar esa lista antes de paginar. Definir el tratamiento de combos en “Más vendidos”.

**Aceptación:** un producto de $2.000 aparece antes que un combo de $10.000 en precio ascendente; los límites del filtro coinciden con el precio visible.

### 7. Media: paginar pedidos y evitar respuestas fuera de orden

**Evidencia:** [Pedidos.tsx](C:/Users/ilaan/ilara-app/components/Pedidos.tsx:99), [browserOrders.ts](C:/Users/ilaan/ilara-app/lib/domain/orders/browserOrders.ts:35).

La lista solicita como máximo 100 pedidos sin navegación a la siguiente página. La búsqueda cambia la consulta con cada tecla. La carga de detalle tampoco invalida solicitudes anteriores: si se abre A y luego B, una respuesta tardía de A puede reemplazar lo visible.

**Implementación:** paginación por cursor o rango, conteo/indicación de resultados, búsqueda con espera breve e identificador de solicitud que descarte resultados viejos. Aplicar el mismo control a los pagos del detalle.

**Aceptación:** con más de 100 pedidos se accede a los antiguos; el detalle siempre corresponde a la selección más reciente incluso con latencia invertida.

### 8. Media: respetar la política de referrer de seguimiento

**Evidencia:** [next.config.ts](C:/Users/ilaan/ilara-app/next.config.ts:76). Confirmado por lectura HTTP de producción en `/pedido`.

La regla específica establece `no-referrer`, pero la regla global posterior la sobrescribe con `strict-origin-when-cross-origin`. El `no-store` sí está presente. No se observó una filtración de tokens; el problema es que no se cumple el endurecimiento expresamente configurado.

**Implementación:** colocar la regla específica después de la global y verificar `/pedido` y `/pedido/[orderNumber]`. Next.js aplica la última cabecera coincidente: [documentación oficial](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers#header-overriding-behavior).

### 9. Media: diferenciar errores operativos de ceros reales

**Evidencia:** [Tablero.tsx](C:/Users/ilaan/ilara-app/components/Tablero.tsx:130), [report.ts](C:/Users/ilaan/ilara-app/lib/observability/report.ts:56), [sendOrderEmail.ts](C:/Users/ilaan/ilara-app/lib/domain/orders/sendOrderEmail.ts:84).

Si falla la lectura de cobros del catálogo, el tablero asigna cero y una lista vacía. Los avisos del panel también pueden caer a cero. Los eventos técnicos terminan en consola; la función llamada `isSentryEnabled` solo comprueba un DSN y no integra por sí sola un sistema externo. El envío de correo no tiene timeout explícito ni cola persistente de reintentos.

**Implementación:** estados “No se pudo actualizar” con última actualización; reintentar sin sustituir datos por cero; bandeja persistente de notificaciones con estado, intentos y último error; alertas ante fallo de pagos, vencimientos o notificaciones. Verificar si existen alertas externas configuradas fuera del repositorio antes de agregar servicios.

### 10. Media: mantener fichas agotadas si interesa conservar enlaces

**Evidencia:** [serverCatalog.ts](C:/Users/ilaan/ilara-app/lib/catalog/serverCatalog.ts:120), [publicAvailability.ts](C:/Users/ilaan/ilara-app/lib/domain/catalog/publicAvailability.ts:32).

La misma regla que oculta agotados en la grilla hace que la ficha responda “no encontrado”. Un enlace compartido deja de servir cuando se vende la última unidad. Es el comportamiento explícito del cambio actual, no un fallo accidental demostrado.

**Propuesta para evaluar:** mantener el producto agotado fuera de la grilla, pero conservar su ficha con “Agotado”, alternativas y eventual aviso de reposición. Los productos despublicados explícitamente seguirían ocultos. Esta modificación requiere validar la intención comercial de la regla vigente.

## Oportunidades para vender más

| Iniciativa | Primera implementación útil | Métrica / aceptación | Esfuerzo relativo |
|---|---|---|---|
| Fichas que respondan dudas | Descripción pública separada de notas internas, contenido/tamaño, acabado, modo de uso y fotos reales | Porcentaje de fichas completas; consultas repetidas por producto | Medio |
| Variantes reales | Agrupar tonos/tamaños bajo un producto padre, con stock y precio por variante | Selección obligatoria de variante y stock correcto en POS/pedido | Alto |
| Búsqueda más tolerante | Quitar espacios externos, normalizar acentos, buscar color/categoría y mostrar alternativas | `balsamo` encuentra `Bálsamo`; tasa de búsquedas sin resultados | Bajo |
| Filtros compartibles | Guardar búsqueda, categoría, orden y página en URL; recuperar al volver de una ficha | Compartir “Labiales” abre esa selección; navegación atrás conserva contexto | Medio |
| Categorías útiles | Ocultar categorías vacías o explicarlas; revisar la concentración en “Otros” | Menos callejones sin productos; mejor distribución del inventario | Bajo |
| Medir el recorrido de compra | Vista de ficha, agregado, apertura de checkout, error de envío y pedido creado; sin PII | Conversión ficha → bolsa → pedido y abandono por paso | Medio |
| Favoritos sin cuenta | Lista local y acceso rápido a guardados | Regreso a productos guardados; cambio de disponibilidad claro | Bajo/medio |
| Reposición para clientes interesados | Registrar solicitud y canal autorizado; aviso cuando vuelva stock | Conversión de solicitudes a compras | Medio |

La prioridad comercial más alta es unificar ficha, bolsa y checkout. Después, mejorar información y descubrimiento. No introducir un chatbot o recomendaciones complejas antes de medir dónde se abandona la compra.

En la revisión pública se mostraron 61 productos y categorías vacías como Bases y Correctores. Es una observación de ese momento, no un conteo permanente. La portada tiene bastante espacio editorial antes de los productos: probar una versión móvil más compacta y medir el acceso a la grilla antes de sustituir el diseño.

## Oportunidades para trabajar mejor en el panel

| Iniciativa | Qué agregaría sobre lo existente | Criterio de éxito | Esfuerzo relativo |
|---|---|---|---|
| Inicio orientado a pendientes | Resumen de transferencias por revisar, pedidos por preparar, listos por entregar y cuentas vencidas, con acceso directo | Resolver cada pendiente desde Inicio sin buscar entre módulos | Medio |
| Compras y proveedores | Convertir alertas de stock en propuesta de compra; proveedor, costo, recepción parcial y actualización de stock | Recibir mercadería una sola vez sin duplicar gasto/stock | Alto |
| Reposición por demanda | Sugerir cantidades con ventas recientes, stock y plazo del proveedor; decisión final manual | Menos quiebres y menos capital inmovilizado | Medio/alto |
| Caja por jornada | Apertura, conteo físico, importe esperado, diferencia y cierre auditable sobre el ledger existente | Una diferencia queda explicada sin editar movimientos históricos | Medio/alto |
| Lotes y vencimientos | Si el volumen lo justifica: lote por recepción, vencimiento y alertas | Identificar existencias próximas a vencer y trazabilidad | Alto |
| Importación controlada | CSV con vista previa, validación y reporte por fila; identificador estable para actualizaciones | Cargar mercadería sin duplicados y con errores comprensibles | Medio |
| Salud operativa | Última ejecución de expiración, notificaciones fallidas, comprobantes por revisar y copias verificadas | Detectar fallos antes que un cliente los reporte | Medio |

Ya existen CRM, márgenes, devoluciones, alertas y cuentas/caja: estas iniciativas deben extenderlos. En particular, compras y caja requieren definir su vínculo con gastos y ledger para no contar dos veces el mismo dinero.

## Arquitectura y mantenimiento

Los componentes más grandes medidos fueron Inventario (874 líneas), Tablero (864), Pedidos (835), Catálogo (804), Checkout (791) y Clientes (773). El tamaño no es un defecto por sí solo; las diferencias entre los dos carritos y las carreras de solicitudes sí justifican extraer comportamiento compartido.

Orden sugerido de extracción: carrito/checkout compartidos, consultas y selección de pedidos, guardado de combos y estado de carga/error del tablero. Evitar una refactorización global simultánea a cambios de pagos o stock.

El catálogo y varios listados internos cargan colecciones sin paginación explícita del servidor. Hoy el catálogo observado es pequeño; antes de crecer conviene definir paginación y filtros en servidor para no depender de límites de respuesta configurados en Supabase. No se verificó el límite remoto efectivo.

La documentación vigente presenta contradicciones: `AUDITORIA.md` aún menciona 29 pruebas y stock alerts pendientes; hay referencias a ausencia de service role mientras el código ya lo utiliza en helpers server-only. El README también mezcla estados de release. Consolidar estado implementado, desplegado y verificado, con fecha y evidencia, facilitará que futuras revisiones no repitan hallazgos cerrados ni ignoren fronteras nuevas.

## Secuencia de implementación propuesta

| Bloque | Entrega | Condición para cerrar |
|---|---|---|
| A. Integridad | Autorización de avisos, combos atómicos, cabecera de seguimiento, corrección de condiciones de envío | Tests negativos de autorización, rollback de combos y HTTP de seguimiento |
| B. Compra consistente | Checkout desde fichas, carrito actualizado, orden global, búsqueda tolerante | E2E desde enlace directo y recuperación del carrito con cambios de stock/precio |
| C. Operación confiable | Paginación y carreras de pedidos, errores visibles, seguimiento de notificaciones | Más de 100 pedidos navegables; respuestas tardías no cambian la selección; fallos distinguibles de cero |
| D. Crecimiento medido | Fichas completas, filtros en URL, embudo y panel de pendientes | Línea base de conversión y tiempo operativo; decidir siguientes funciones con esos datos |
| E. Expansión operativa | Compras/proveedores, variantes y eventualmente lotes/caja por jornada | Modelo de datos y relación con stock/ledger definidos antes de desarrollar |

Los esfuerzos son relativos, no estimaciones de calendario. Para dimensionar D/E faltan datos del negocio: cantidad de pedidos por canal, tareas manuales más frecuentes, proveedores, uso de tonos/tamaños y necesidad de trazabilidad. Esto no impide empezar por A/B.

## Evidencia visual local

- [Catálogo escritorio](C:/Users/ilaan/ilara-app/docs/review-2026-09-05/catalog-desktop.png).
- [Catálogo móvil](C:/Users/ilaan/ilara-app/docs/review-2026-09-05/catalog-mobile.png).
- [Ficha móvil](C:/Users/ilaan/ilara-app/docs/review-2026-09-05/product-mobile.png).
- [Bolsa desde ficha, solo WhatsApp](C:/Users/ilaan/ilara-app/docs/review-2026-09-05/cart-mobile.png).

Próxima entrega recomendada: bloque A seguido del checkout compartido de B. Las funciones adicionales quedan priorizadas, no implementadas en esta revisión.
