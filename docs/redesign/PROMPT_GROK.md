# Prompt para pegar en Grok

Trabajá en el repositorio `C:\Users\ilaan\ilara-app`. Quiero que implementes un rediseño completo del frontend público de Ilara: catálogo, ficha de producto, detalle de combos, bolsa, checkout, pago y seguimiento. El panel administrativo queda fuera del rediseño.

Primero leé, en este orden:

1. `AGENTS.md` y las guías relevantes de Next.js instaladas en `node_modules/next/dist/docs/`.
2. `docs/redesign/PLAN_FRONTEND.md`: es la especificación funcional, visual y técnica.
3. `docs/redesign/prototipo.html`: abrilo en un navegador y revisá las siete pantallas en desktop y móvil. Es una referencia de diseño; sus datos y lógica son de demostración, no deben copiarse a producción.
4. `docs/CORRECCIONES_2026-09-05.md`: preservá las protecciones y funciones ya corregidas.

Ejecutá el plan por etapas, no te quedes en recomendaciones ni construyas sólo la portada. Usá datos, hooks, Server Actions y componentes operativos existentes. La estética nueva tiene fondo blanco cálido, tipografía Outfit, acciones cereza, tarjetas simples y un recorrido de compra consistente. Eliminá decoración redundante y priorizá productos, búsqueda, precio y siguiente acción.

Antes de editar, revisá el estado de Git: hay trabajo anterior sin commit que ya fue publicado; no lo reviertas, no lo borres ni partas de una base que lo pierda. Aislá estilos públicos para no alterar el panel, incluso cuando el documento tenga la clase `.dark`.

No reescribas backend, precios, stock, RPC, RLS, pagos ni envíos para facilitar la UI. No uses los descuentos fijos, datos ficticios o simulaciones del HTML. No inventes variantes, ratings, badges o beneficios. Conservá tests y `data-testid`, capacidades de seguimiento y controles de doble envío. No cambies secretos ni hagas cobros/pedidos reales para probar.

Comenzá implementando etapa 1 y continuá con las restantes. Tomá decisiones visuales rutinarias según la especificación. Preguntá sólo si existe una ambigüedad de negocio que no podés resolver con el código. Actualizá `docs/redesign/ESTADO.md` después de cada etapa con cambios, pruebas, bloqueos y siguiente paso para poder retomar si se corta el contexto.

Terminá con lint, TypeScript, pruebas y build; verificá los recorridos en navegador a 360/390/768/1440 px, estados vacíos y errores, teclado y modales. Las pruebas que escriben deben usar local/staging con los guards actuales. Si no hay un entorno disponible, reportalo sin fingir que pasó una prueba integral.

Entregá archivos modificados, capturas comparables, checks y pendientes. Dejá el resultado listo para revisión visual antes de publicar. No despliegues este rediseño automáticamente.
