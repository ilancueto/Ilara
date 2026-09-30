# Pruebas contra Supabase en la nube

Decisión vigente desde el 29/09/2026: no usar Docker. El proyecto de producción `qbbnvdmadgomfmrsfxlo` está excluido de todos los comandos mutantes de prueba.

## Configuración

Crear un proyecto dedicado de staging en la cuenta correcta de Supabase. Copiar `.env.test.example` a `.env.test.local`, que está excluido de Git y del deploy. Completar:

| Variable | Uso |
|---|---|
| `SUPABASE_TEST_PROJECT_REF` | Referencia exacta del proyecto de staging |
| `SUPABASE_TEST_URL` | `https://<ref>.supabase.co`, sin rutas o parámetros |
| `SUPABASE_TEST_ANON_KEY` | Clave pública de staging |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | Clave privilegiada de staging, sólo servidor/tests |
| `SUPABASE_TEST_DB_URL` | Conexión Postgres de staging con TLS; preferir pooler de sesión si no hay IPv6 |
| `SUPABASE_ACCESS_TOKEN` | Token de gestión con acceso a staging para tipos y Edge Functions |
| `ORDER_ACCESS_SECRET`, `CRON_SECRET` | Secretos exclusivos de prueba |

En GitHub Actions configurar las mismas variables como Repository Secrets. Nunca colocar valores en YAML, documentación, capturas ni respuestas del chat. El pipeline falla si no están configuradas; no omite silenciosamente las pruebas.

## Ejecución sin Docker

En PowerShell, con `.env.test.local` configurado:

```powershell
node --env-file=.env.test.local scripts/check-cloud-test-env.mjs
node --env-file=.env.test.local scripts/cloud-db.mjs prepare
node --env-file=.env.test.local scripts/cloud-db.mjs security
node --env-file=.env.test.local scripts/check-rls-coverage.mjs
node --env-file=.env.test.local scripts/detect-insecure-anon-policy.mjs
node --env-file=.env.test.local scripts/gen-db-types.mjs
node --env-file=.env.test.local scripts/check-db-types-drift.mjs
npm run test:cloud:integration
npm run test:cloud:e2e
```

`prepare` aplica migraciones pendientes y seed ficticio en staging; no resetea la base. Desplegar `passkey-auth` y `shipping-quotes` en staging con `supabase functions deploy ... --project-ref <ref> --use-api --no-verify-jwt`, después de validar el destino. `--use-api` compila en Supabase sin Docker.

El runner crea exclusivamente cuentas ficticias de prueba. El runner E2E genera un build con staging, antes de ejecutar Playwright contra `next start`. Las suites existentes conservan sus verificaciones de precios, stock, pagos, roles, Storage y limpieza de fixtures. No ejecutar dos sesiones mutantes simultáneas sobre el mismo staging; CI serializa los workflows y ejecuta E2E después de la matriz de DB.

El control negativo de RLS crea la política permisiva dentro de una transacción y hace ROLLBACK antes de comprobar la denegación restaurada. No publica esa política en PostgREST.

## Comprobaciones independientes

```powershell
npm run lint
npm test
npm run test:db-isolated
npm run check:pwa-icons
npm audit
npm run build
```

PGlite aplica las migraciones de la aplicación sin modificar su SQL. Sólo reproduce el esquema mínimo de plataforma necesario para esas migraciones. Comprueba las reglas SQL, pero no reproduce los servicios Auth, Storage HTTP, PostgREST, advisors del proveedor ni el envío real de emails.

## Evidencia requerida para cerrar una publicación

Guardar resultados reales de integración y E2E en staging, regeneración/drift de tipos y advisors. Después del deploy, ejecutar smoke de sólo lectura y chequeo SEO contra el dominio. Un resultado SQL aislado o un build correcto no deben documentarse como aprobación del flujo de pagos del proveedor.
