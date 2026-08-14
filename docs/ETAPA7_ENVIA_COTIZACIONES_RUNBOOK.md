# Stage 7 — Envia.com: cotizaciones de envío

**Estado:** cerrado y verificado en producción el 14 de agosto de 2026.

## Alcance

- Pedir provincia, ciudad/localidad, calle y altura; resolver el CP sin entrada manual.
- Cotizar envíos nacionales mediante Envia.com usando el CP validado.
- Origen fijo: Neuquén Capital, CP `8300`.
- Un bulto tipo bolsa: `20 × 35 × 5 cm`, hasta `1 kg`.
- Mostrar transportista, servicio, plazo orientativo, importe y moneda.
- Guardar y consumir un snapshot autoritativo de la opción elegida.
- Incluir el envío en el total del pedido y mostrarlo en el panel admin.

No genera etiquetas, no descuenta saldo, no agenda retiros y no activa tracking.
Esas operaciones requieren una etapa nueva porque pueden producir cargos.

## Arquitectura y seguridad

Flujo: checkout → Edge Function `shipping-quotes` → Georef (provincias,
localidades y normalización) → Nominatim (CP) → geocodes/Shipping API de Envia
→ `shipping_quotes` → RPC `create_catalog_order` → `orders`.

- `ENVIA_TOKEN` existe sólo como secreto de Supabase Edge Functions.
- No existe variable `NEXT_PUBLIC_ENVIA_*` ni token versionado.
- `shipping_quotes` y `shipping_quote_requests` tienen RLS y `REVOKE` para
  `PUBLIC`, `anon` y `authenticated`; sólo `service_role` opera directamente.
- `shipping_geocode_cache` conserva solamente hash irreversible + CP; nunca la
  dirección en claro. `shipping_geocode_requests` serializa llamadas no cacheadas.
- Nominatim se llama sólo por acción del usuario, detrás del backend, con
  User-Agent/Referer identificables, caché por 30 días y máximo global de 1 req/s.
- La UI muestra atribución a Georef Argentina y OpenStreetMap contributors.
- El cliente envía únicamente `shipping_quote_id`, nunca importe o transportista.
- El RPC bloquea la fila, exige vigencia, consume una sola vez y conserva
  idempotencia del pedido.
- Vigencia: 15 minutos. Límite: 12 solicitudes por hash de IP cada 10 minutos.
- CORS permitido para `ilara.com.ar`, `www.ilara.com.ar` y loopback local.
- Timeout por llamada a Envia: 12 segundos. Un carrier sin cobertura no invalida
  las opciones de otros carriers.
- Logs estructurados sin token, teléfono, email ni IP en claro.

## Contrato productivo comprobado

Envia requiere un carrier explícito aunque la referencia indique que puede ser
opcional. La función consulta los carriers argentinos habilitados y combina las
respuestas válidas. El geocodificador puede responder un objeto o un arreglo;
ambos formatos están soportados.

Endpoints usados:

- `GET https://apis.datos.gob.ar/georef/api/v2.0/provincias`
- `GET https://apis.datos.gob.ar/georef/api/v2.0/localidades`
- `GET https://apis.datos.gob.ar/georef/api/v2.0/direcciones`
- `GET https://nominatim.openstreetmap.org/search`
- `GET https://geocodes.envia.com/zipcode/AR/{cp}`
- `POST https://api.envia.com/ship/rate/`

Endpoint prohibido en Stage 7: `/ship/generate/`.

## Evidencia de validación

- `supabase db reset --local`: historia completa aplicada, incluida
  `20260814092526_stage7_envia_shipping.sql` y
  `20260814205248_stage71_structured_shipping_address.sql`.
- Tipos de base regenerados y sin drift.
- Vitest: 23 archivos / 140 tests verdes.
- ESLint y `next build` verdes.
- Cobertura RLS: 35 tablas; matriz anon/service role verde.
- Control negativo de policy anónima detectado y limpiado.
- Catálogos reales: 24 provincias; Neuquén devuelve 59 localidades.
- E2E local: provincia → localidad → calle/altura → CP automático → opción de
  envío → pedido/panel, con subtotal, envío y total correctos.
- Navegador: checkout, selección, total y confirmación sin errores de consola.
- Producción: ocho opciones para CP 1000; la menor durante la prueba fue OCA
  sucursal–sucursal; acceso `anon` a `shipping_quotes` devolvió HTTP 401.

Las tarifas son dinámicas y la evidencia no constituye una promesa comercial.

## Deploy

1. `supabase secrets set --env-file <archivo-local> --project-ref <ref>`
2. `supabase db push --linked`
3. `supabase functions deploy shipping-quotes --no-verify-jwt`
4. Desplegar la app desde `main`.
5. Seleccionar provincia/localidad, ingresar calle/altura y verificar CP automático.
6. Cotizar sin llamar a `/ship/generate/`.
7. Verificar `anon` denegado en tablas de Stage 7.

## Forward-fix y operación

- Si Envia falla, el checkout informa indisponibilidad y no crea el pedido.
- Si Georef no reconoce calle/altura o Nominatim no devuelve CP, falla cerrado:
  no inventa un CP ni habilita confirmación.
- Si una tarifa vence, el usuario debe cotizar otra vez.
- Para retirar temporalmente la función, deshabilitar el botón de cotización en
  app mediante forward-fix; no reabrir acceso a tablas ni aceptar precios cliente.
- Si cambia el token, actualizar `ENVIA_TOKEN` en secretos y volver a desplegar
  la función si fuera necesario.
- Si cambia el bulto, versionar código, pruebas y este runbook antes del deploy.

## Riesgo residual

La credencial productiva fue compartida durante la sesión de implementación.
Conviene rotarla en Envia.com y reemplazar inmediatamente el secreto de Supabase;
no está presente en Git ni en el bundle del navegador.
