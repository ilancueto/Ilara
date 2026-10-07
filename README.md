# Ilara Beauty POS

Ilara nació del emprendimiento de Mara. Yo, Ilan, armé esta aplicación para acompañarla: que pudiera tener sus productos, ventas, pedidos y cuentas en un mismo lugar, y dedicarle más tiempo a lo que le gusta hacer.

Lo que empezó como una forma de apoyarla fue creciendo con las necesidades del negocio. Hoy compartimos el código bajo licencia MIT para que otras personas puedan conocer cómo está hecho, aportar mejoras y evaluar si les sirve como base para su propio comercio.

**Uso actual:** Ilara Beauty, en Neuquén, Argentina. No contamos con adopción externa documentada. La aplicación conserva nuestra marca y varias configuraciones propias; adaptarla requiere trabajo, no basta con cambiar el nombre.

[Ver el catálogo real](https://ilara.com.ar/catalogo) · [Adaptar a otro comercio](docs/ADAPTAR_A_OTRO_COMERCIO.md) · [Contribuir](CONTRIBUTING.md)

Estado actual: [ESTADO.md](ESTADO.md). Desarrollo y CI utilizan Supabase en la nube, sin Docker; [configuración de staging](docs/SUPABASE_CLOUD_TESTS.md).

Sistema de gestión para negocio de belleza: inventario, ventas, gastos, clientes y catálogo público con integración WhatsApp.

## Stack

- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Supabase** (auth, base de datos, storage)
- **Tailwind CSS v4**
- **Recharts** (gráficos)
- **PWA** (instalable en móvil/escritorio, **online-only** — sin modo offline)

## Requisitos

- Node.js **22 o posterior** (CI utiliza Node 22; también requerido por las versiones actuales de las librerías de Supabase)
- Proyecto Supabase de staging en la nube para las pruebas mutantes (separado de producción)
- Cuenta de [Supabase](https://supabase.com)

## Instalación

```bash
# Clonar e instalar dependencias
git clone https://github.com/ilancueto/Ilara.git
cd Ilara
npm ci

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Iniciar en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

En PowerShell, usar `Copy-Item .env.example .env.local` para copiar la plantilla. Completarla con un proyecto Supabase propio antes de iniciar. La plantilla por sí sola no crea la base de datos ni una cuenta de administrador. Seguir la [guía de adaptación](docs/ADAPTAR_A_OTRO_COMERCIO.md) para esos pasos.

## Qué incluye

- Gestión de productos, stock, ventas, gastos y clientes.
- Catálogo público con bolsa de compra y contacto por WhatsApp.
- Pedidos, seguimiento y herramientas para operar el negocio.
- Autenticación, roles y políticas de acceso en la base de datos.
- Pruebas unitarias, SQL aislado, integración y pruebas de navegador.

Las integraciones de pagos, envíos y correo requieren sus propias cuentas y configuración. La PWA necesita internet; no registra ventas sin conexión. El catálogo publicado es el negocio real, no una demostración para crear pedidos de prueba.

## Ayudar al proyecto

Si algo no se entiende, encontraste un error o estás intentando adaptarlo, podés abrir una [issue](https://github.com/ilancueto/Ilara/issues). Nos sirven especialmente las mejoras en la instalación, la documentación, la accesibilidad y la separación de la marca de la lógica del negocio. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

El software y su documentación están disponibles bajo [MIT](LICENSE): podés usarlos, modificarlos y distribuirlos, incluso comercialmente, conservando el aviso de copyright y la licencia. Se ofrecen sin garantía.

La licencia no concede derechos sobre marcas ni implica que una instalación de terceros represente a Ilara Beauty. Para otro comercio, usá tu identidad, contactos y contenido. Las dependencias y recursos de terceros conservan sus propias licencias.

## Variables de entorno

Crear `.env.local` con:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/Public key de Supabase |
| `NEXT_PUBLIC_SUPABASE_IMAGE_HOST` | (Opcional) Solo hostname del storage, si cambiás de proyecto. Por defecto usa el del `next.config`. |

Obtener valores en: Supabase Dashboard → Settings → API. Ver **`.env.example`** para plantilla completa.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:e2e` | Tests E2E (Playwright; arranca el servidor si hace falta) |
| `npm run test:smoke` | Smoke posdeploy de solo lectura (catálogo, login, headers, SW) |
| `npm run test:db-security` | Matriz anon/service sobre staging en la nube |
| `npm run test:db-rls` | RLS habilitado en tablas `public` |
| `npm run test:db-insecure-control` | Control negativo transaccional en staging en la nube |
| `npm run db:types` / `db:types:check` | Generar / verificar tipos desde staging en la nube |
| `npm run db:prepare:test` | Aplicar migraciones y seed ficticio a staging (destino explícito) |
| `npm run test:db-isolated` | Migraciones y reglas SQL aisladas, sin Docker |
| `npm run pwa-icons` | Generar iconos PWA con dimensiones reales |
| `npm run check:pwa-icons` | Verificar iconos, manifest y SW online-only |
| `npm run analyze` | Bundle analyzer (`ANALYZE=true`) |

## Supabase en la nube

La aplicación mantiene Supabase remoto. Las pruebas mutantes y CI usan un proyecto dedicado de staging con destino explícito. No se utiliza Docker. Copiar `.env.test.example` a `.env.test.local` y seguir [SUPABASE_CLOUD_TESTS.md](docs/SUPABASE_CLOUD_TESTS.md).

**Fuente de estado vigente:** [ESTADO.md](ESTADO.md). [AUDITORIA.md](AUDITORIA.md) y [PLAN.md](PLAN.md) conservan la evolución histórica.

Los runbooks por etapa conservan decisiones de diseño y evidencia de sus respectivas fechas. Para comandos de base de datos y CI seguir la guía de nube; para estado de publicación usar ESTADO.md.

## Documentación extra

| Documento | Contenido |
|-----------|-----------|
| [`ESTADO.md`](ESTADO.md) | Estado actual y límites de verificación |
| [`docs/SUPABASE_CLOUD_TESTS.md`](docs/SUPABASE_CLOUD_TESTS.md) | Staging y CI en la nube, sin Docker |
| [`AUDITORIA.md`](./AUDITORIA.md) / [`PLAN.md`](./PLAN.md) | Evolución histórica de riesgo y ejecución |
| [`docs/ETAPA5_ARQUITECTURA_RUNBOOK.md`](docs/ETAPA5_ARQUITECTURA_RUNBOOK.md) | Clientes, DAL, DTOs y dominios |
| [`docs/ETAPA6_1_PEDIDOS_CATALOGO_RUNBOOK.md`](docs/ETAPA6_1_PEDIDOS_CATALOGO_RUNBOOK.md) | Pedidos desde catálogo |
| [`docs/ETAPA6_2_ALERTAS_REPOSICION_RUNBOOK.md`](docs/ETAPA6_2_ALERTAS_REPOSICION_RUNBOOK.md) | Alertas de stock |
| [`docs/ETAPA6_6_FINANZAS_RUNBOOK.md`](docs/ETAPA6_6_FINANZAS_RUNBOOK.md) | Stage 6.6: CxC/CxP, ledger auditable y conciliación |
| [`docs/ETAPA4_CALIDAD_OPERATIVA_RUNBOOK.md`](docs/ETAPA4_CALIDAD_OPERATIVA_RUNBOOK.md) | Stage 4: E2E/CI, a11y |
| [`docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md`](docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md) | Logs, eventos, Sentry opt-in |
| [`docs/ETAPA4_OPERACION_RUNBOOK.md`](docs/ETAPA4_OPERACION_RUNBOOK.md) | Backup, rollback, RPO/RTO propuestas |
| [`docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md`](docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md) | PWA online-only (cerrado) |
| [`docs/ETAPA2_RUNBOOK.md`](docs/ETAPA2_RUNBOOK.md) | Reconstrucción, diff, tipos, CI Stage 2 |
| [`docs/STAGE2_INVENTORY.md`](docs/STAGE2_INVENTORY.md) | Inventario sanitizado de objetos |
| [`docs/ETAPA1_RUNBOOK.md`](docs/ETAPA1_RUNBOOK.md) | Roles y deploy Stage 1 (cerrado) |
| [`docs/VERCEL_PROYECTO_AUTORIZADO.md`](docs/VERCEL_PROYECTO_AUTORIZADO.md) | Solo Vercel `ilara` |
| [`docs/MIGRACIONES_SUPABASE.md`](docs/MIGRACIONES_SUPABASE.md) | Convención de migraciones |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Convenciones y checklist de PR |
| [`docs/COMPONENTES_UI.md`](docs/COMPONENTES_UI.md) | Patrones UI |
| `docs/PLAN_*`, `docs/AUDITORIA_*`, roadmaps históricos | **Archivados / no vigentes** |

## BCyP (release rápido)

**Build → Commit → Push:** antes de subir cambios importantes: `npm run build` tiene que pasar, luego `git commit` y `git push`. En equipo, conviene que **CI** (GitHub Actions) ejecute lint + test + build en cada PR (`.github/workflows/ci.yml`).

## PWA (instalable, sin offline)

- **Decisión:** la app se puede instalar (icono, `display: standalone`), pero
  **requiere internet**. No hay precache, ni cache de páginas/API/Supabase, ni
  ventas offline.
- Service worker mínimo: `public/sw.js` (registrado por `PwaRegister`).
- Manifest: `public/manifest.json`.
- Iconos: `npm run pwa-icons` (dimensiones reales) y `npm run check:pwa-icons`.
- Ruta `/~offline`: solo mensaje informativo online; el SW no redirige ahí.
- Runbook: [`docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md`](docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md).

## Estructura del proyecto

```
├── app/              # Rutas (App Router)
│   ├── page.tsx      # App principal (dashboard, inventario, ventas, gastos, clientes)
│   ├── login/        # Inicio de sesión
│   ├── gastos/       # Vista dedicada de gastos
│   └── catalogo/     # Catálogo público para clientes
├── components/       # Componentes React
├── lib/              # Servicios, tipos, utilidades
├── context/          # Contextos (Toast)
└── proxy.ts            # Protección de rutas (auth, Next.js 16+)
```

## Rutas

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/` | Autenticado | Dashboard, inventario, ventas, gastos, clientes |
| `/login` | Público | Inicio de sesión |
| `/catalogo` | Público | Catálogo para compartir con clientes |
| `/gastos` | Autenticado | Gestión de gastos (vista ampliada) |

## Iconos PWA

En `public/`: `icon-192.png` (192×192), `icon-512.png` (512×512),
`icon-512-maskable.png` (512×512), `apple-touch-icon.png` (180×180). Generar
desde `app/icon.png` con `npm run pwa-icons` (usa `sharp`; no copiar el mismo
archivo renombrado). Verificar: `npm run check:pwa-icons`.

## Backup y exportación

- **Desde la app:** En el dashboard (Inicio), el botón **Exportar datos** permite descargar productos, ventas, clientes y gastos en **CSV** o **JSON**. Podés elegir “todo” o filtrar ventas y gastos por período. Los gastos exportados son solo los del usuario logueado.
- **Desde Supabase:** En el [Dashboard de Supabase](https://supabase.com/dashboard) → tu proyecto → **Database** → **Backups** podés usar los backups automáticos. Para un export manual de tablas: **Table Editor** → elegir tabla → **Export** (CSV), o usar el **SQL Editor** con `COPY ... TO STDOUT` / herramientas externas (pg_dump con la connection string del proyecto).

## Deploy

Compatible con [Vercel](https://vercel.com). **Único proyecto autorizado:** `ilara`
(`prj_l1212uETlGghvn8jChfiXCp68SzN`) → https://ilara.com.ar. El nombre `ilara-app`
es solo del package npm y de Supabase, no un destino Vercel. Ver
[`docs/VERCEL_PROYECTO_AUTORIZADO.md`](docs/VERCEL_PROYECTO_AUTORIZADO.md).
