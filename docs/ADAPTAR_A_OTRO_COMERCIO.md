# Usar Ilara como base para otro comercio

Ilara es una aplicación hecha para un negocio real de belleza. Puede servir como referencia para un comercio pequeño con inventario, ventas y catálogo, pero aún tiene textos y configuraciones propios de Ilara. Esta guía enumera qué hace falta para preparar una instalación independiente; no representa una validación completa de un segundo comercio.

## 1. Preparar una copia independiente

El software está disponible bajo [MIT](../LICENSE). Conservá el aviso de copyright y la licencia al redistribuirlo. Necesitás Node 22 o posterior, Git y un proyecto Supabase propio. Cloná el repositorio y ejecutá `npm ci` como indica el README.

Si hacés un fork, deshabilitá los workflows operativos que apuntan a `ilara.com.ar` antes de habilitar GitHub Actions. El CI de nube necesita secretos de tu propio staging. Los proyectos, dominios y credenciales de Ilara no forman parte de una instalación independiente.

## 2. Preparar la base y la cuenta de acceso

La fuente de esquema es `supabase/migrations/`, en orden cronológico. Los archivos de `supabase/sql/` son históricos y no deben aplicarse además de las migraciones.

Para ensayar en un proyecto Supabase vacío de staging, seguí [SUPABASE_CLOUD_TESTS.md](SUPABASE_CLOUD_TESTS.md) con tus propias referencias y claves. El script `prepare` aplica las migraciones y el seed ficticio: modifica ese proyecto. No lo apuntes a una base con datos reales. El flujo vigente del repositorio utiliza Supabase en la nube y no requiere Docker.

Creá tu usuario de email y contraseña en Supabase Auth. Asigná el primer rol administrador siguiendo la sección «Asignación de roles» de [ETAPA1_RUNBOOK.md](ETAPA1_RUNBOOK.md), usando el UUID de tu usuario. La pantalla de login no registra usuarios ni concede el rol administrador automáticamente.

Copiá `.env.example` a `.env.local` y completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con el proyecto propio. Usá `NEXT_PUBLIC_SUPABASE_IMAGE_HOST` si necesitás configurar su host de imágenes. `.env.local` no se sube a Git. Una clave privilegiada nunca debe tener el prefijo `NEXT_PUBLIC_`.

Las migraciones no configuran todas las cuentas de proveedores ni despliegan por sí solas las Edge Functions. Revisá las guías del repositorio para cada integración que quieras usar.

## 3. Cambiar la identidad y los destinos

Antes de compartir la instalación, revisá como mínimo:

| Parte | Archivos para revisar |
|---|---|
| WhatsApp del comercio | `lib/config.ts` |
| Dominio público | `NEXT_PUBLIC_SITE_URL`, `lib/site.ts`, `lib/catalog/catalogSeo.ts` |
| Nombre y datos estructurados | `lib/productStructuredData.ts`, metadatos del catálogo; `lib/storefrontIdentity.ts` si está presente en tu versión |
| Encabezado y pie del catálogo | `components/storefront/StorefrontHeader.tsx`, `components/storefront/StorefrontFooter.tsx` |
| Historia y contactos de Ilara | Revisar las páginas públicas; `app/sobre-ilara/page.tsx` si está presente en tu versión |
| Login, títulos y descripciones | `components/Login.tsx`, `app/layout.tsx`, `components/Catalogo.tsx` |
| Logos, iconos y vistas previas | `public/`, `app/icon.png`, `public/manifest.json` |
| Comprobantes y mensajes al cliente | `lib/comprobanteVenta.ts`, `lib/domain/orders/` |
| Tareas operativas | `.github/workflows/operations-monitor.yml`, `.github/workflows/expire-catalog-payments.yml`, `vercel.json` |

No todos los valores se cambian desde variables de entorno. Buscá también `Ilara`, `ilara.com.ar` y `Neuquén` para localizar textos y destinos restantes. Conservá los nombres técnicos y las referencias históricas cuando corresponda.

La licencia de software no debe interpretarse como autorización para representar al negocio Ilara ni usar sus datos reales. Usá tu propia marca y contenido; comprobá los derechos de imágenes y otros recursos antes de redistribuirlos.

## 4. Verificar con datos ficticios

Ejecutá `npm run lint`, `npm test`, `npm run test:db-isolated` y `npm run build`. Para integración y E2E usá la guía de staging. Probá el login, los roles, una venta, los movimientos de stock, el catálogo y los pedidos con datos de prueba. Verificá que los enlaces, WhatsApp y mensajes apunten a tu comercio.

La presencia de código para Mercado Pago, envíos o correo no significa que el proveedor esté listo. Esas integraciones requieren una validación aparte con sus modos de prueba y tu configuración.

## 5. Publicar tu instalación

Necesitás tu propio proyecto de hosting, dominio y secretos. Las instrucciones de Vercel que nombran el proyecto autorizado `ilara` describen la operación de este repositorio para su propietario: no son un destino para instalaciones de terceros. No copies ni reutilices `.vercel/` del mantenedor.

Antes de aceptar pedidos reales, comprobá permisos de base de datos y Storage, copias de seguridad y comportamiento de pagos y notificaciones. No uses el catálogo de Ilara como entorno de pruebas.

## Qué falta mejorar

Centralizar la marca, documentar mejor el alta de una instalación vacía y facilitar el CI de forks son oportunidades de contribución. Por ahora no ofrecemos un instalador automático ni soporte con tiempos garantizados.
