# Ilara: rediseño completo del catálogo público

Fecha: 5 de septiembre de 2026. Documento de ejecución para Grok. Propuesta pendiente de aprobación visual por el dueño; no se modificó la aplicación para crearla.

## Resultado buscado

Una tienda de belleza simple de recorrer desde el celular. Al entrar, la persona entiende qué vende Ilara, puede buscar y ve productos reales. Al elegir un producto, reconoce precio, disponibilidad y siguiente acción. Al comprar, mantiene el contexto y entiende cuándo se crea el pedido y cuándo se paga.

Referencia visual: abrir `docs/redesign/prototipo.html` en un navegador. Incluye catálogo, producto, bolsa, checkout, pago, seguimiento y sin resultados. El selector oscuro superior y el botón de simulación móvil son controles del prototipo: NO pertenecen al producto final.

El prototipo usa fotografías públicas actuales y datos de demostración. Los precios, descuentos, categorías, badges, disponibilidad y orden de ese HTML no son una fuente de verdad. No copiar sus fórmulas ni su JavaScript al producto. Sus pantallas de pago/seguimiento muestran intención visual, no todas las reglas operativas. Las especificaciones de este documento y los contratos actuales prevalecen.

## Dirección visual

Concepto: belleza cotidiana, ordenada y cercana. Fondo blanco cálido; cereza para acciones; texto oscuro; fotografía protagonista. Abandonar los bloques editoriales extensos, adornos dorados, títulos serif reiterados, fotografías genéricas de Unsplash y tarjetas con demasiadas capas. No reemplazarlos por gradientes, cristales, carruseles automáticos ni una portada gigante.

Mantener el nombre Ilara. El wordmark tipográfico `ilara.` del prototipo es una propuesta, no un cambio de identidad aprobado: usar el logo actual si el dueño quiere conservarlo, respetando la altura y el espacio definidos. No introducir corazones de wishlist, estrellas, testimonios o etiquetas de popularidad sin datos y funcionalidad existentes.

### Sistema de diseño

| Token | Valor propuesto | Uso |
|---|---|---|
| Fondo | `#FFFEFA` | Superficie principal |
| Superficie | `#FFFFFF` | Formularios y paneles |
| Superficie secundaria | `#F4F2EE` | Imágenes, búsqueda, notas |
| Texto | `#242222` | Títulos, importes, cuerpo |
| Texto secundario | `#68615C` | Metadatos y ayudas |
| Acción | `#A42447` | CTA principal, selección |
| Acción hover | `#861B39` | Hover del CTA |
| Acento suave | `#F6E6E8` | Selección suave, mensajes neutros |
| Borde | `#D6D0CA` | Campos y botones secundarios |
| Separador | `#E9E5E1` | División decorativa |
| Error | `#A51D27` | Texto de error acompañado de mensaje |
| Éxito | `#236044` | Confirmaciones verificadas |

- Outfit local, ya instalado; no descargar otra fuente. Títulos 550–600, cuerpo 400, botones 550. Evitar mayúsculas en labels de formularios.
- Tipos desktop/móvil: h1 48/32, h2 28/24, cuerpo 16/16, metadatos 13/13. Precio en tarjeta 20/18. Inputs mínimo 16 px para evitar zoom de iOS.
- Espaciado: 4, 8, 12, 16, 24, 32, 48, 64. Contenedor 1240 px; margen 28 desktop, 16 móvil. Radio 8 en controles y 12 en superficies. Sombras sólo en overlays.
- Grilla: 2 columnas desde 360 px, 3 desde 768 px, 4 desde 1100 px. Gap 12/20/24. A 320 px mantener dos sólo si nombres y botones caben; si no, una columna.
- Fotos con relación uniforme cercana a 1:1.1, `object-fit: contain`, sin cortar producto. No depender de `mix-blend-mode` para que se vean bien: comprobar fotos oscuras, transparentes y con fondo propio. Fallback sobrio para imágenes ausentes.
- Sin movimiento automático. Transiciones 120–180 ms y respeto de `prefers-reduced-motion`.
- Un tema claro coherente para TODO el recorrido público. No modificar el tema del panel. El wrapper público debe fijar sus tokens y evitar que `.dark h1`, `.dark p` y fondos globales lo contaminen. No quitar `.dark` del documento porque afecta al panel. No mostrar un toggle de tema sin diseñar y verificar su alternativa.

## Arquitectura de la experiencia

### 1. Catálogo `/catalogo`

Header: marca a la izquierda, búsqueda visible, bolsa con cantidad. En móvil, marca y bolsa en primera línea, búsqueda de ancho completo en segunda. El acceso administrativo queda como enlace discreto en el footer; conservar `/login` y su acceso directo.

Debajo: categorías reales en una fila desplazable horizontalmente. No inventar taxonomía ni asignar por palabras en el nombre. Si la base tiene otras categorías, renderizar las existentes. Ofertas o combos pueden ser filtros derivados sólo con datos válidos y accesibles.

Intro compacta, sin fotografía de stock: título y una línea. En móvil, máximo aproximado 130 px de alto. A 390 × 844 deben verse las fotos de la primera fila sin hacer scroll. Al buscar, reducir u ocultar la intro y mostrar el contexto de resultados.

Barra de resultados: título/cantidad calculada, filtros y orden. Mantener las opciones de orden existentes; el ejemplo “Recomendados” del prototipo NO autoriza inventar un ranking. Default actual: novedades. Productos y combos participan de un mismo orden por precio visible.

Filtros: desktop popover o panel lateral; móvil sheet accesible con título, cerrar, aplicar y limpiar. Precio y categorías soportadas. Al aplicar filtros o buscar, volver a página 1. Mostrar chips removibles y cantidad de filtros. Cero resultados conserva búsqueda/filtros y ofrece limpiar.

Conservar paginación accesible. No agregar infinite scroll en esta entrega. Recomendada mejora: sincronizar búsqueda, categoría, orden y página con query params validados para compartir búsquedas y recuperar scroll al volver de producto. No cambiar rutas canónicas de fichas ni indexar arbitrariamente todos los filtros.

### 2. Tarjeta de producto / combo

Orden: foto → marca si existe → nombre → precio principal → alternativa por transferencia cuando corresponda → acción “Agregar a la bolsa”. Toda foto/título navega a detalle. El botón agrega y confirma con toast “Agregado a tu bolsa” + “Ver bolsa”; no abrir un modal por cada agregado.

Foto estable, nombre legible de hasta tres líneas. No tooltip como única forma de leerlo en móvil. Un badge máximo, obtenido del dominio actual; no rotador automático. Sin precio tachado salvo descuento válido, sin porcentajes inventados.

CTA deshabilitado cuando no hay disponibilidad; si el carrito aún se valida, comunicar carga. Combos muestran “Ver qué incluye” y disponibilidad calculada con componentes. Mantener el detalle actual de combos; no hace falta agregar una ruta nueva.

### 3. Ficha `/catalogo/p/[id]`

Desktop: galería 55%, compra 45%, ejes y separación consistentes. Móvil: migas → foto → marca/nombre → precio → disponibilidad → cantidad/CTA → entrega → descripción pública → relacionados.

Galería con miniaturas si hay varias fotos, controles manuales, teclado, zoom accesible, sin autoplay. Color/variante sólo si hay un campo real; un string `color` no implica inventario de variantes seleccionables. No inventar ingredientes, beneficios ni descripciones con `notes` internas.

Un CTA principal “Agregar a la bolsa”. WhatsApp como acción secundaria. En móvil, barra de compra inferior sólo cuando el CTA principal salió del viewport; esconderla al abrir bolsa, filtros, teclado o checkout. Respetar `env(safe-area-inset-bottom)` y reservar espacio para que no tape contenido.

Entrega: explicación breve y veraz; cotización en checkout. No prometer envío gratis, plazos o devoluciones no confirmados. Relacionados reutilizan la tarjeta y los datos existentes.

### 4. Bolsa

Desktop drawer de hasta 480 px o superficie equivalente; móvil pantalla completa con scroll propio, encabezado fijo y resumen inferior. El prototipo muestra una página amplia para presentar la composición: se puede mantener el overlay actual sin introducir rutas.

Fila: foto, nombre, precio por unidad, cantidad y eliminar explícito. Diferenciar eliminar de bajar cantidad: el decremento en uno puede quedar deshabilitado; eliminar tiene su propio botón. Cupón colapsado inicialmente, con éxito/error explícito y opción quitar. No ocultar un cupón aplicado.

Resumen: productos, descuento por cupón si existe, entrega aún sin determinar y subtotal. No anunciar un total definitivo si faltan método de entrega o pago. CTA “Continuar con mi pedido”. WhatsApp secundario y claramente separado del checkout web.

Llamar `refreshCarrito()` antes de avanzar. Si cambió precio/stock, mostrar mensaje persistente y pedir revisar nuevamente. Mientras verifica, bloquear doble avance y mostrar “Verificando bolsa…”. Bolsa vacía incluye CTA para seguir mirando. Errores de red conservan lo disponible y ofrecen reintentar; no borrar silenciosamente.

### 5. Checkout

Una superficie continua, sin modales anidados. Desktop datos a la izquierda/resumen a la derecha. Móvil una columna, resumen desplegable accesible y CTA al final. Pasos reales: “Datos y entrega” → “Pago”. No presentar “Listo” hasta tener confirmación del servidor.

Datos: nombre, teléfono, email opcional, notas opcionales. Labels visibles, `autocomplete`, `inputMode`, errores debajo y foco al primer campo inválido. Preservar datos al volver a bolsa, salvo invalidaciones justificadas por el servidor.

Entrega: mantener retiro, domicilio y a coordinar, con toda la estructura actual de provincia/localidad/dirección, cotización, proveedor, costo y vencimiento. Seleccionar domicilio debe revelar el formulario REAL y las opciones devueltas; el toast del prototipo es sólo ilustrativo. No fijar envío en cero ni fabricar cotizaciones.

Antes de enviar, resumen con importes actuales y texto honesto: se crea un pedido, el pago es el paso siguiente. Mantener el control de doble envío y todos los errores recuperables de la acción actual. Si el pedido se creó y el email falló, mostrar pedido creado, nunca sugerir duplicarlo.

### 6. Pago y seguimiento `/pedido` y `/pedido/[orderNumber]`

Usar el mismo header simplificado, tokens, botones y superficies. Conservar los estados completos del sistema: transferencia pendiente, comprobante cargado/rechazado, Mercado Pago pendiente/aprobado/rechazado, vencimiento, cancelación y errores de acceso.

Pago: importe autoritativo por método, instrucciones de transferencia actuales, copia de datos con feedback, carga real de comprobante y estados de progreso. Mercado Pago inicia el flujo existente. Nunca marcar pagado desde UI ni sustituir una integración por simulación.

Seguimiento: número, estado actual, próxima acción, pago, entrega, ítems y contacto. Timeline derivado de eventos reales; cancelado/vencido no aparecen como etapas exitosas. No mostrar “pedido confirmado” cuando sólo está recibido. Token inválido: mensaje y acceso seguro de recuperación; sin datos personales.

### Estados transversales

Diseñar explícitamente skeleton sin cambios de tamaño, error de catálogo con reintento, imagen rota, resultado vacío, bolsa vacía, sin stock, precio modificado, cupón inválido/vencido, cotización fallida/vencida, pedido enviándose, pedido creado/email fallido, pago pendiente/rechazado y seguimiento sin autorización. Cada uno debe explicar qué pasó y cuál es la próxima acción. Nada de spinners indefinidos o ceros engañosos.

## Mapa del código y límites

| Área | Archivos actuales | Trabajo |
|---|---|---|
| Catálogo | `components/Catalogo.tsx`, `components/Catalogo/CatalogoEditorial.module.css` | Extraer presentación, aplicar shell, toolbar y grilla |
| Datos/listas | `hooks/useCatalogData.ts`, `hooks/useCatalogDerivedLists.ts` | Reutilizar; cambios acotados para URL/estados si necesarios |
| Bolsa/cupón | `hooks/useCarrito.ts`, `hooks/useCatalogCoupon.ts` | Preservar referencias, revalidación, stock compartido y protección contra respuestas tardías |
| Precio | `components/Catalogo/CatalogPrice.tsx`, `lib/domain/payments/catalogDisplayPrice.ts`, `lib/catalogPricing.ts` | Rediseñar presentación; cálculos siguen en sus helpers actuales |
| Producto | `components/product/ProductPublicDetailClient.tsx`, `ProductRelatedTile.tsx` | Shell, galería, bloque de compra, relacionados |
| Overlays | `ModalCarrito.tsx`, `ModalDetalleCombo.tsx`, `ModalConfirmacionVaciar.tsx`, `components/gallery/ModalImagenPrevia.tsx` | Unificar controles/foco; conservar callbacks y reglas |
| Checkout | `components/Catalogo/CheckoutPedido.tsx` y `.module.css` | Reorganizar visualmente; no reemplazar lógica de entrega/creación |
| Pago/seguimiento | `PedidoPagoClient.tsx`, `PedidoSeguimientoClient.tsx`, `ConsumeFollowToken.tsx` | Reutilizar capacidades y contratos; rediseñar composición |
| Rutas/SEO | `app/catalogo/page.tsx`, `app/catalogo/p/[id]/page.tsx`, `app/catalogo/loading.tsx`, `app/pedido/` | Mantener SSR/SSG, metadata, canonical y rutas |
| Tema | `app/globals.css`, `app/layout.tsx`, `ThemeContext` | Auditar herencia; estilos públicos aislados sin romper panel |

Componentes propuestos en `components/storefront/`: `StorefrontShell`, `StorefrontHeader`, `StorefrontFooter`, `CategoryNav`, `ProductCard`, `CatalogToolbar`, `FilterSheet`, `EmptyState`, `OrderSummary`, `ProductGallery`, `MobilePurchaseBar`. Crear sólo los que reduzcan duplicación real. La orquestación de estado puede permanecer en los componentes actuales al inicio.

Tokens en un CSS Module público o stylesheet con namespace `.storefront`. Evitar utilidades globales genéricas y `!important` acumulados. No reescribir el panel, Auth, RLS, RPC, email, pagos o envíos. No crear migraciones para un cambio visual. Si falta un dato público necesario, omitir el bloque y registrar la carencia antes de ampliar backend.

## Ejecución por etapas y checkpoints

Antes de empezar: leer `AGENTS.md`, guías locales de Next en `node_modules/next/dist/docs/`, este documento, el prototipo y `docs/CORRECCIONES_2026-09-05.md`. Revisar `git status`: hay correcciones previas sin commit; no descartarlas ni mezclarlas inadvertidamente. Crear rama `codex/catalogo-redesign` si es posible, conservando el estado de trabajo actual. No partir de un checkout que pierda las correcciones publicadas.

1. **Base visual + tarjetas.** Crear tokens/shell/header/footer y tarjeta reutilizable; conectar a datos reales. Validar a 390 y 1440 px, con clase `.dark` presente y ausente. Checkpoint: no hay contaminación visual del panel ni placeholders de negocio.
2. **Catálogo completo.** Búsqueda, categorías, filtros, orden, paginación, empty/error/loading. Reusar listas unificadas. Checkpoint: filtro/orden combinados y regreso desde ficha conservan contexto.
3. **Producto + combos + bolsa.** Galería, compra, stock compartido, cantidades/cupón, overlays y revalidación. Checkpoint: misma bolsa entre catálogo y ficha, ninguna doble resta de stock en UI, foco correcto al cerrar.
4. **Checkout.** Revestir el componente existente sin rehacer la integración. Checkpoint: retiro/domicilio/a coordinar; cotización válida/inválida; datos conservados; doble clic no crea dos pedidos.
5. **Pago + seguimiento.** Aplicar sistema visual a todos los estados reales. Checkpoint: no hay simulaciones del prototipo en código de producción; capacidades y cabeceras seguras preservadas.
6. **QA y entrega.** Revisar desktop/móvil/teclado, ejecutar checks, guardar capturas y actualizar estado. Publicación posterior sólo cuando la revisión esté cerrada y el dueño la autorice.

Al terminar cada etapa actualizar `docs/redesign/ESTADO.md` con archivos cambiados, verificación realizada, pendientes y siguiente paso. Si se agota contexto/límite, ese archivo permite retomar. No marcar completo por haber construido sólo la portada.

## Criterios de aceptación

- A 360, 390, 768 y 1440 px no hay scroll horizontal accidental ni botones tapados. Primera fila de productos visible en móvil sin scroll inicial largo.
- Un visitante puede buscar, filtrar, abrir ficha, agregar producto/combo, modificar bolsa, aplicar/quitar cupón y abrir checkout desde catálogo y ficha.
- Todos los importes usan helpers actuales y formato ARS; no se pierde precio por transferencia ni se descuentan promociones dos veces.
- Carrito manipulado, stock modificado y componentes compartidos mantienen las protecciones recientes. Un error de actualización no deja avanzar con una cotización no comprobada.
- Sin enlaces falsos, wishlist ficticia, badges inventados ni claims de envío gratis. No hay `mock`, `demo`, `IL-DEMO`, arrays de productos o fórmulas de descuento del prototipo en producción.
- Formularios conservan labels, validación, campos opcionales y errores recuperables. Todos los pasos operativos anteriores siguen disponibles.
- Modales con nombre accesible, foco inicial, trap, Escape, restauración de foco y bloqueo de scroll. Controles de mínimo 44 px; inputs 16 px; contraste AA verificado; mensajes no dependen sólo del color.
- Sólo la imagen principal visible recibe prioridad. `next/image` tiene `sizes` correctos y dimensiones reservadas; imágenes restantes lazy. No duplicar requests de catálogo al extraer componentes ni convertir toda la app en un nuevo Client Component.
- Rutas, canonical, metadata, JSON-LD sin envío gratis falso, sesión y protección `no-referrer` siguen funcionando. El panel mantiene sus estilos y navegación.

## Verificación y entrega para el dueño

Ejecutar `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test`, `npm run build`. Baseline conocido: 232 tests aprobados, 28 warnings en mockups. No "arreglar" el resultado desactivando tests o reglas.

Revisar y adaptar sólo selectores dependientes del diseño en `e2e/catalogo.spec.ts`, `carrito-cupon-whatsapp.spec.ts`, `orders-catalog.spec.ts`, `mobile.spec.ts`, `a11y.spec.ts` y `pwa.spec.ts`. Conservar contratos `data-testid` existentes (`cart-checkout`, `checkout-pedido`, `checkout-name`, `checkout-phone`, `checkout-email`, `fulfillment-retiro`, `checkout-submit`, `checkout-success`, etc.); inventariarlos antes de editar.

Las E2E que escriben requieren Supabase local/staging: no apuntarlas a producción ni quitar los guards de `e2e/helpers/urlGuard.ts`. Si Docker sigue indisponible, reportar el bloqueo; complementar con navegación pública sin crear pedidos y tests unitarios, sin afirmar cobertura integral.

Capturas finales: catálogo desktop/móvil, filtros móvil, ficha móvil, bolsa, checkout domicilio y retiro, pago y seguimiento con fixtures. Verificar manualmente teclado y retorno de foco; probar carga lenta y error de red. Comparar contra el prototipo y anotar diferencias justificadas.

Entrega: resumen concreto de cambios, screenshots, tests ejecutados, limitaciones y cambios pendientes. No publicar automáticamente por instrucciones heredadas de la corrección anterior: esta tarea es un rediseño nuevo que requiere revisión visual.
