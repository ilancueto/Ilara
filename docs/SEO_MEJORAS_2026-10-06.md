# Mejoras de visibilidad de Ilara Beauty

6 de octubre de 2026, Argentina. Autorizado por el usuario: mejorar y publicar la web, actuar en Search Console y comprobar resultados con el navegador interno.

## Cambios publicados

- Título principal del catálogo: `Ilara Beauty | Maquillaje y skincare en Neuquén`. Descripción orientada a los productos, precios, disponibilidad y pedidos reales.
- Nombre de marca completo visible en la introducción y el pie, preservando el eslogan y la historia de Mara e Ilan.
- Instagram oficial confirmado por el propietario: https://www.instagram.com/ilara__beauty/. Enlaces visibles en el pie y en las consultas de la historia.
- Organization JSON-LD consistente en las páginas que usan StorefrontShell: marca, ubicación, fundadores, correos y sameAs al Instagram. Sin domicilios, opiniones, financiación ni credenciales inventadas.
- Seller de las ofertas enlazado al mismo identificador de organización.
- AboutPage y CollectionPage/ItemList describen la historia y los productos efectivamente renderizados; no se inventan fichas para combos.
- Preguntas útiles y desplegables sobre pedidos, consultas y coordinación de entrega/retiro. No se promete envío gratis, horarios, políticas ni cobertura no confirmados.

No se añadió WebSite schema pretendiendo habilitar el nombre del sitio de Google: su documentación exige la raíz del dominio. Actualmente la raíz redirige al catálogo para visitantes y sirve una aplicación privada para usuarios autenticados; cambiar ese comportamiento excedería esta mejora puntual y requiere analizar el enrutamiento completo.

## Búsqueda real

Navegador interno, Google sin iniciar sesión, ubicación mostrada Neuquén. Consulta `Ilara Beauty Neuquén`. No apareció ilara.com.ar en los resultados de la primera página observada. El resumen generado por Google decía no encontrar un negocio exacto y sugirió otros negocios de belleza. Ese resumen es una salida automática y no prueba inexistencia ni explica el rechazo de Anthropic. Captura: `tmp/seo-busqueda-google-antes.jpg`.

## Publicación y validación

- Proyecto autorizado Vercel `ilara`, ID `prj_l1212uETlGghvn8jChfiXCp68SzN`.
- Deployment `dpl_3v5VmrBaZc7LHperBDDSCYB23VT1`, build de producción, probado con vercel curl autenticado antes de promover.
- URL del deployment: https://ilara-1iemrmr8q-ilara.vercel.app. Dominio publicado: https://ilara.com.ar.
- Build local y remoto correctos, TypeScript correcto, ESLint de archivos modificados correcto.
- Pruebas existentes de sitemap y normalización: 11/11.
- Comprobaciones HTTP SEO en producción: 14/14.
- Smoke general de producción: 16/16; catálogo, login, cabeceras, PWA, 404 y acceso privado protegidos.
- Identidad, Instagram, referencias JSON-LD y contenido preservado comprobados en HTML del deployment protegido antes de promover.
- Navegador: historia y catálogo publicados, FAQ operativa, un H1 en historia y sin desbordamiento horizontal a 375 px. Capturas `tmp/seo-web-mobile.jpg` y `tmp/seo-web-publicada.jpg`.

Límite de pruebas: el modo local con inyección de fallos no quedó completamente verde. Primero se ejecutó sin habilitar la inyección (17/20), después encontró una respuesta cacheada (19/20), y en desarrollo el fallo sintético devuelve 500 pero incluye noindex en el documento de error (19/20). No se atribuye ese comportamiento a los cambios de identidad ni se informa esa suite como aprobada. Los errores simulados no se habilitaron en Vercel. Requiere investigación separada del comportamiento de errores de Next y del fixture local.

## Google Search Console

- Sitemap https://ilara.com.ar/sitemap.xml reenviado: Google confirmó éxito y muestra fecha de envío 6/10/26. El dato de última lectura puede tardar en actualizarse.
- /sobre-ilara: Google confirmó solicitud de indexación, añadida a cola de rastreo prioritaria. No significa que ya esté indexada.
- /catalogo: Google confirmó solicitud de indexación/rastreo para actualizar la página ya indexada con la nueva identidad y metadatos. Captura: `tmp/seo-catalogo-indexacion-solicitada.jpg`.
- Soft 404 de /catalogo/p/37: validación iniciada el 6/10/26, tras comprobar que el producto retirado responde 404/noindex. No se informa como validación completada. Captura: `tmp/seo-soft404-validacion.jpg`.

## Qué aún limita el crecimiento

La indexación y el posicionamiento son distintos. Solicitar rastreo no asigna primeros puestos. Según Search Console, la base era 119 impresiones y 1 clic en tres meses. Mejorar la presencia de marca requiere que Google procese cambios y que existan referencias reales del emprendimiento.

Conviene enlazar https://ilara.com.ar desde la bio del Instagram oficial; no se accedió ni modificó esa cuenta. Para un Perfil de Empresa de Google se debe confirmar primero que el negocio cumple las condiciones de atención presencial y usar datos reales. Para Merchant Center faltan políticas y detalles comerciales confirmados; no se creó una cuenta ni se aceptaron términos.

Se preguntó al propietario si atienden presencialmente, tienen retiro atendido o realizan entregas propias; la elegibilidad y los datos de Google Maps quedan pendientes de esa respuesta. [Google: condiciones de elegibilidad](https://support.google.com/business/answer/13763036?hl=en-419) y [factores de posicionamiento local](https://support.google.com/business/answer/7091?hl=es).

No se enviaron mensajes a Anthropic ni se prometió admisión al programa. No se crearon automatizaciones de seguimiento ni se compraron anuncios.

Fuentes: [Google Search Essentials](https://developers.google.com/search/docs/essentials), [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), [nombre del sitio](https://developers.google.com/search/docs/appearance/site-names), [inspección de URL](https://support.google.com/webmasters/answer/9012289).
