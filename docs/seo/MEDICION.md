# Medición SEO

## Baseline

No hay acceso a Search Console ni a CrUX en esta sesión. **No hay clics, impresiones, CTR ni Core Web Vitals de campo que reportar.** Lighthouse de laboratorio no se ejecutó como sustituto de p75 de usuarios reales.

Cuando exista la propiedad:

1. Verificar [https://ilara.com.ar](https://ilara.com.ar) en [Search Console](https://search.google.com/search-console).
2. Exportar 28 y 90 días: consultas, páginas, dispositivo, cobertura, vide/CWV si aparecen.
3. Separar consultas con “ilara” (marca) del resto.
4. Pedidos: cruzar fechas de pedidos del panel con sesiones orgánicas sólo si hay UTM o un canal fiable. Una visita al checkout no es una compra.

## Eventos (sin PII)

Hoy hay Analytics y Speed Insights de Vercel en el layout. No se agrega otro tracker. No enviar nombre, teléfono, email ni número de pedido a analítica.

Revisión de consentimiento: si más adelante se usa publicidad, revisar duplicación y la política de cookies existente. No se toca ahora.

## Elegibilidad de listados

- **Merchant Center / listados gratuitos:** no se abre cuenta ni se sube feed. Un feed futuro debería usar URL canónica `https://ilara.com.ar/catalogo/p/{id}`, precio ARS igual al visible, disponibilidad alineada a la regla de stock, identificador estable (`id`), sin GTIN inventado.
- **Google Business Profile:** no se crea ni se edita. Sólo si el dueño confirma domicilio, horario y modalidad (retiro / envío) públicos.

## Revisiones

| Cuándo | Qué mirar | Cómo interpretarlo |
|---|---|---|
| 14 días | Cobertura: 404 reales vs soft 404; sitemap aceptado | Un cambio de estado HTTP no prueba tráfico |
| 30 días | Impresiones de `/catalogo` y fichas; consultas no marca | Sin atribuir causalidad al rediseño o al SEO |
| 90 días | Clics, CTR, páginas que entran, CWV de campo p75 (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1) | Comparar con el baseline de 90 días, no con una semana |

IA en Search: Google indica que las prácticas de SEO técnico y el contenido útil siguen aplicando; no hace falta `llms.txt` ni markup especial ([guía](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
