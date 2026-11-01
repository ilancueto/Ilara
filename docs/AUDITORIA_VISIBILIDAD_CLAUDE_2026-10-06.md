# Ilara: visibilidad pública y verificación para Claude Startups

Auditoría del 6 de octubre de 2026, aproximadamente 21:00, Argentina. Inspección de producción, búsquedas web y propiedad de dominio verificada en Google Search Console. No se modificó la web ni se solicitaron indexaciones durante esta auditoría.

## Conclusión

La base técnica permite rastrear e indexar Ilara. Google ya conoce el catálogo y numerosos productos. La presencia pública de la marca es pequeña y la página con la historia, fundadores y contactos todavía no estaba en el índice. Esto puede dificultar una corroboración externa, pero no permite atribuir el rechazo de Anthropic al SEO. No conocemos su proceso privado ni qué fuentes consultaron.

## Evidencia de Google Search Console

| Comprobación | Resultado observado | Alcance |
| --- | --- | --- |
| Indexación de páginas | 54 indexadas y 21 no indexadas | Informe agregado con última actualización 20/9/26; no es un inventario actual en tiempo real |
| Catálogo | URL en Google; canónica elegida igual a /catalogo | Último rastreo 4/10/26 04:38:38, Googlebot smartphone; obtención correcta y rastreo/indexación permitidos |
| /sobre-ilara | Google no reconoce esta URL; sin último rastreo | Estado del índice antes de la prueba en vivo |
| Prueba en vivo de /sobre-ilara | Disponible para Google; se puede indexar | Prueba 6/10/26 21:01; acceso correcto no garantiza selección ni indexación |
| Rendimiento | 119 impresiones, 1 clic, CTR 0,8%, posición media 13,3 | Web, 5/7/26 a 4/10/26. La posición mezcla consultas; no significa posición 13 para la marca |
| Consulta ilara | 16 impresiones, 0 clics | Mismo período; la tabla de consultas no revela todas las consultas por privacidad |
| Sitemap enviado | Correcto, 80 páginas descubiertas | Enviado 3/4/26; última lectura mostrada 12/4/26. Es dato histórico, no los 63 enlaces actuales |
| Acciones manuales | Ningún problema detectado | Informe específico de Search Console |
| Problemas de seguridad | Ningún problema detectado | No equivale a auditoría de seguridad completa |
| Core Web Vitals | Sin datos para móvil/ordenador | No permite evaluar rendimiento real por esta fuente |

### Las 21 exclusiones no representan 21 errores que corregir

- 3 páginas con redirección: categoría compatible con normalización de direcciones; no se inspeccionaron sus ejemplos y no se concluye que todas sean correctas.
- 1 Soft 404: /catalogo/p/37, rastreo del 19/9/26. Hoy devuelve HTTP 404 y noindex; no devuelve una página inexistente con 200.
- 17 rastreadas actualmente sin indexar: 12 URLs de productos, dos fuentes WOFF2, un favicon y las rutas /$ y /&. Fuentes e iconos no necesitan indexarse como páginas de negocio.
- De los 12 productos de esa lista, /57 y /61 hoy devuelven 404/noindex. Los otros 10 (/45, /46, /36, /18, /31, /23, /8, /35, /43, /29) responden 200/index,follow. Poder indexarlos no obliga a Google a hacerlo; requiere revisar individualmente contenido y estado actual del índice si se trabaja el posicionamiento comercial.

## Acceso público y SEO técnico actual

La suite existente `npm run test:seo`, ejecutada contra producción en modo autorizado de solo lectura, pasó 14/14 verificaciones: catálogo paginado con contenido HTML, canónicas, filtros y búsquedas noindex, normalizaciones, productos válidos con Product/Offer y ARS, productos inválidos con 404/noindex, sitemap, robots y login noindex.

Comprobaciones adicionales:

- Catálogo y historia responden 200 sin sesión. El contenido esencial existe en HTML, sin depender de iniciar sesión o ejecutar JavaScript.
- Historia identifica a Mara e Ilan, explica sus roles, enlaza ambos correos corporativos y contiene Organization JSON-LD.
- Sitemap actual responde 200 y tiene 63 URLs: catálogo, historia y 61 productos.
- robots.txt permite rastreo general y excluye /pedido; no contiene bloqueo específico a Google o Anthropic.
- HTTP y www se normalizan al dominio HTTPS sin www. La raíz redirige temporalmente al catálogo para visitantes. No se propone cambiarla a permanente sin analizar su comportamiento para usuarios autenticados.
- Peticiones desde nuestra máquina con nombres de agente Googlebot, Claude-User y Claude-SearchBot obtuvieron la historia con 200. Esto NO prueba acceso desde las IP reales de esos rastreadores. La prueba en vivo de Search Console sí añade evidencia de acceso desde la infraestructura de inspección de Google.
- El dominio tiene MX de Zoho y registros SPF y DMARC. Esto verifica configuración de correo; no constituye verificación legal de la empresa ni prueba de cada buzón. No se comprobó DKIM.

Evidencia técnica detallada: `tmp/seo-public-audit.json`. Capturas: `tmp/seo-sobre-ilara-google.jpg` y `tmp/seo-rendimiento-google.jpg`.

## Qué encuentra una investigación externa

Las búsquedas de dominio exacto, marca con Neuquén y nombres de fundadores no devolvieron una corroboración clara de la empresa en esta herramienta. La consulta site: tampoco dio resultados. Esto no significa que Google no haya indexado Ilara: Search Console confirma que sí, y tiene prioridad para evaluar el estado del índice.

La herramienta web pudo leer una versión del catálogo rastreada cinco días antes, sin la historia recién añadida. No pudo abrir la historia en esta sesión, aunque HTTP directo y Google en vivo sí pudieron. No se puede atribuir ese fallo de la herramienta a un bloqueo del sitio ni a lo que vio Anthropic.

No se encontraron enlaces a perfiles sociales oficiales en el catálogo ni en la historia. No se concluye que esos perfiles no existan; simplemente no están vinculados desde las páginas examinadas.

Un evaluador que abra la web encuentra una tienda de belleza real con catálogo y pedidos. La postulación describe software para operar esa tienda y una evaluación futura de Claude, pero todavía no hay uso de Claude ni una demostración pública de esa integración. Esto puede afectar el encaje o la evaluación: es una hipótesis, no una razón de rechazo confirmada.

## Qué dicen las fuentes oficiales

La página vigente de Claude Startups admite startups fundadas en los últimos cinco años o financiadas en los últimos dos, incluyendo emprendimientos autofinanciados. Pide cuenta de Console, correo de empresa coherente con el dominio y una descripción de lo que se construye. No publica un umbral SEO ni un mínimo de páginas indexadas.

Los términos indican evaluación de múltiples factores, incluidos tracción, inversión/financiación e integración/uso de Claude, con decisión discrecional. Cumplir antigüedad y correo no garantiza admisión. Tampoco dice que sea obligatorio pagar Claude antes de postularse.

La FAQ afirma que la mayoría de las decisiones llega en minutos y otras solicitudes pasan a revisión manual. El tiempo de respuesta por sí solo no identifica el mecanismo concreto de esta solicitud.

## Próximos pasos en orden

1. Solicitar indexación de /sobre-ilara y reenviar el sitemap actual desde la propiedad existente. Registrar la solicitud y comprobar posteriormente el estado; no esperar indexación inmediata ni repetir continuamente. Estas acciones quedaron pendientes en esta auditoría de solo lectura.
2. Vincular perfiles reales del emprendimiento con el sitio y el dominio de correo. Mantener nombre, ubicación y roles coherentes. Incorporar solo datos y enlaces verificables; no inventar LinkedIn, reseñas, inversión o clientes.
3. Pedir revisión o aclaración a Anthropic aportando el enlace directo a la historia y, si lo requieren, documentación real de constitución/inicio. No publicar identificadores personales o documentos sensibles para hacer SEO. No se envió ningún mensaje.
4. Para el SEO comercial, mejorar contenido propio de los diez productos activos excluidos y examinar sus inspecciones actuales. Es secundario para verificar fundadores.
5. Si se avanza con Claude, construir una prueba útil del caso de uso interno y describir honestamente su estado. No gastar ni inventar integración para aparentar elegibilidad.

La historia humana puede conservarse: no hay evidencia de que su tono perjudique la admisión. La mejora necesaria es descubrimiento y corroboración, no convertir la tienda en una presentación escrita para Anthropic.

## Fuentes

- [Claude Startups: elegibilidad y FAQ vigente](https://claude.com/programs/startups)
- [Términos oficiales: evaluación y discrecionalidad](https://www.anthropic.com/startup-program-official-terms)
- [Google: inspección de URL, prueba en vivo y límites](https://support.google.com/webmasters/answer/9012289)
- [Google: límites de la consulta site:](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site?hl=es)
- [Google: preguntas sobre rastreo e indexación](https://developers.google.com/search/help/crawling-index-faq)
- [Anthropic: rastreadores y robots.txt](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
