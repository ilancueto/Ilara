# Mapa de contenidos e intención de búsqueda

Sitio: `https://ilara.com.ar`. Inventario real del catálogo público (septiembre 2026): categorías en nav (Bases, Brochas, Correctores, Iluminadores, Labiales, Skincare, Sombras, Otros) y ~61 fichas. Sin volúmenes de herramienta; la prioridad sale de lo que el sitio ya vende.

No se crean páginas doorway por ciudad. Neuquén aparece como zona de servicio, no como sucursal inventada.

## Arquitectura recomendada

| Intención | Página | Estado | Próxima acción |
|---|---|---|---|
| Comprar / explorar catálogo | `/catalogo` | Existe | Conservar H1 útil; índice de fichas rastreable |
| Producto concreto | `/catalogo/p/{id}` | Existe | Completar descripción pública en el panel cuando falte |
| Categoría (labiales, skincare…) | Hoy filtro en el cliente | No hay URL indexable | No fabricar `?cat=` indexable. Si más adelante hay texto único, una ruta estable por categoría |
| Cómo pedir / retiro Neuquén | No hay artículo | No existe | Un bloque breve y veraz en catálogo o ficha (ya hay entrega en PDP) |
| Marca Ilara | `/catalogo` | Existe | No crear blog genérico de “belleza 2026” |
| Login / pedido / pago | `/login`, `/pedido` | `noindex` | Mantener fuera del inventario SEO |

Enlaces internos actuales: header → catálogo; tarjetas y migas → ficha; ficha → relacionados de la misma categoría; footer → catálogo y seguimiento (noindex).

## 10 briefs priorizados

Ninguno inventa beneficios médicos, certificaciones, ingredientes ni reseñas. Si falta el dato en el panel, el brief lo marca.

### 1. Catálogo general — P1
- Intención: explorar maquillaje y skincare para comprar.
- URL: `/catalogo` (existente)
- Título propuesto: Catálogo de belleza en Neuquén | Ilara
- Esquema: H1 actual + primera grilla + índice de productos.
- Datos faltantes: ninguno crítico.
- Enlaces: fichas más vendidas o combos reales.

### 2. Kit Lip Oil + Bálsamo — P1
- Intención: producto concreto (kit labial).
- URL: `/catalogo/p/86` (existente)
- Título: el nombre + Tejar.
- Esquema: foto, precio ARS, disponibilidad, marca Tejar, cómo pedirlo.
- Datos faltantes: descripción pública si no hay campo en el DTO.
- Enlaces: otros labiales de la misma categoría.

### 3. Labiales — P1
- Intención: “labiales” / “lip oil”.
- URL: hoy no hay landing; usar fichas de Labiales y el catálogo.
- Título propuesto (si se crea más adelante): Labiales | Ilara
- Esquema: 1 párrafo de qué hay en esa categoría + lista de fichas reales.
- Datos faltantes: texto de categoría aprobado; no indexar `?cat=` mientras tanto.
- Enlaces: kits y bálsamos existentes.

### 4. Skincare — P1
- Intención: cuidado de piel / parches / hidratación que Ilara ya vende.
- URL: fichas de Skincare; sin página nueva hasta tener copy propio.
- Título propuesto futuro: Skincare | Ilara
- Esquema: listado de productos reales de esa categoría.
- Datos faltantes: copy de categoría.
- Enlaces: fichas de skincare del inventario.

### 5. Bases y polvos — P2
- Intención: base, polvo compacto.
- URL: fichas (p. ej. polvo compacto nude si sigue publicado).
- Título: nombre + marca.
- Esquema: precio, marca, color/tono si el campo existe.
- Datos faltantes: no inventar tono como variante con stock propio.
- Enlaces: brochas o esponjas reales.

### 6. Brochas y accesorios — P2
- Intención: brochas, esponjas, toallas desmaquillantes.
- URL: fichas de Brochas / Accesorios.
- Título: nombre del producto.
- Esquema: para qué se usa según el nombre público, sin claims clínicos.
- Datos faltantes: descripción si el nombre no alcanza.
- Enlaces: bases o polvos relacionados.

### 7. Combos — P2
- Intención: sets / kits.
- URL: el catálogo filtra Combos; el detalle sigue en modal (sin ruta nueva, según el rediseño).
- Título: no crear `/combos` vacío.
- Esquema: “Ver qué incluye” con componentes reales.
- Datos faltantes: si se quiere indexar un combo, haría falta una ficha con URL propia (cambio de producto, no de SEO cosmético).
- Enlaces: componentes del combo.

### 8. Cómo hacer un pedido — P2
- Intención: “pedir por Instagram/WhatsApp” vs checkout web.
- URL: no crear artículo largo. Un párrafo en `/catalogo` o footer.
- Título: no aplica.
- Esquema: se arma la bolsa, se crea el pedido, después se paga. Retiro o envío cotizado.
- Datos faltantes: horario de retiro si el dueño lo quiere público.
- Enlaces: `/catalogo`.

### 9. Iluminadores y correctores — P3
- Intención: categorías del inventario.
- URL: fichas existentes.
- Título: nombre + marca.
- Esquema: igual que otras fichas.
- Datos faltantes: copy de categoría.
- Enlaces: resto de maquillaje.

### 10. Sombras — P3
- Intención: sombras / ojos.
- URL: fichas de Sombras.
- Título: nombre + marca.
- Esquema: precio y disponibilidad.
- Datos faltantes: paleta/tonos sólo si hay campo real.
- Enlaces: delineadores o kits si existen.

## Qué no hacer

- Blog masivo de “tendencias belleza”.
- Una URL por localidad de Neuquén.
- Indexar cada combinación de filtro.
- Textos generados que reciclen el mismo párrafo en 50 fichas.
