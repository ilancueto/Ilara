# ✨ Ilara Beauty POS

Sistema de gestión para negocio de belleza: inventario, ventas, gastos, clientes y catálogo público con integración WhatsApp.

## Stack

- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Supabase** (auth, base de datos, storage)
- **Tailwind CSS v4**
- **Recharts** (gráficos)
- **PWA** (instalable en móvil/escritorio, **online-only** — sin modo offline)

## Requisitos

- Node.js `>=20.9.0` (Next.js 16)
- Docker Desktop (para Supabase local / Stage 2)
- Cuenta de [Supabase](https://supabase.com)

## Instalación

```bash
# Clonar e instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Iniciar en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

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
| `npm run test:db-security` | Matriz anon/service sobre Supabase local |
| `npm run test:db-rls` | RLS habilitado en tablas `public` |
| `npm run test:db-insecure-control` | Control negativo de policy anónima (local) |
| `npm run db:types` / `db:types:check` | Generar / verificar tipos desde esquema local |
| `npm run db:reset` | `supabase db reset --local` |
| `npm run pwa-icons` | Generar iconos PWA con dimensiones reales |
| `npm run check:pwa-icons` | Verificar iconos, manifest y SW online-only |
| `npm run analyze` | Bundle analyzer (`ANALYZE=true`) |

## Supabase local (Stage 2)

```bash
npx supabase start
npx supabase db reset --local
npm run db:types
npm run test:db-rls
# exportar API_URL / ANON_KEY / SERVICE_ROLE_KEY desde: npx supabase status -o env
npm run test:db-security
```

**Fuentes vigentes** (únicas para estado de riesgo y ejecución):
[`AUDITORIA.md`](./AUDITORIA.md), [`PLAN.md`](./PLAN.md).

Runbooks por etapa: Stage 2 [`docs/ETAPA2_RUNBOOK.md`](docs/ETAPA2_RUNBOOK.md);
Stage 3 PWA; Stage 4 [`docs/ETAPA4_CALIDAD_OPERATIVA_RUNBOOK.md`](docs/ETAPA4_CALIDAD_OPERATIVA_RUNBOOK.md)
(desplegado); Stage 5 arquitectura **local**
[`docs/ETAPA5_ARQUITECTURA_RUNBOOK.md`](docs/ETAPA5_ARQUITECTURA_RUNBOOK.md).

## Documentación extra

| Documento | Contenido |
|-----------|-----------|
| [`AUDITORIA.md`](./AUDITORIA.md) / [`PLAN.md`](./PLAN.md) | **Fuentes vigentes** de riesgo y ejecución |
| [`docs/ETAPA5_ARQUITECTURA_RUNBOOK.md`](docs/ETAPA5_ARQUITECTURA_RUNBOOK.md) | Stage 5: clientes, DAL, DTOs, dominios (**local**) |
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
