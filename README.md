# ✨ Ilara Beauty POS

Sistema de gestión para negocio de belleza: inventario, ventas, gastos, clientes y catálogo público con integración WhatsApp.

## Stack

- **Next.js 16** (App Router)
- **React 19** + TypeScript
- **Supabase** (auth, base de datos, storage)
- **Tailwind CSS v4**
- **Recharts** (gráficos)
- **PWA** (instalable en móvil)

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
| `npm run test:db-security` | Matriz anon/service sobre Supabase local |
| `npm run test:db-rls` | RLS habilitado en tablas `public` |
| `npm run test:db-insecure-control` | Control negativo de policy anónima (local) |
| `npm run db:types` / `db:types:check` | Generar / verificar tipos desde esquema local |
| `npm run db:reset` | `supabase db reset --local` |
| `npm run pwa-icons` | Copiar `logo_icon.png` a iconos PWA |
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

Fuentes vigentes de auditoría y plan: [`AUDITORIA.md`](./AUDITORIA.md),
[`PLAN.md`](./PLAN.md). Runbook Stage 2: [`docs/ETAPA2_RUNBOOK.md`](docs/ETAPA2_RUNBOOK.md).

## Documentación extra

| Documento | Contenido |
|-----------|-----------|
| [`AUDITORIA.md`](./AUDITORIA.md) / [`PLAN.md`](./PLAN.md) | **Fuentes vigentes** de riesgo y ejecución |
| [`docs/ETAPA2_RUNBOOK.md`](docs/ETAPA2_RUNBOOK.md) | Reconstrucción, diff, tipos, CI Stage 2 |
| [`docs/STAGE2_INVENTORY.md`](docs/STAGE2_INVENTORY.md) | Inventario sanitizado de objetos |
| [`docs/ETAPA1_RUNBOOK.md`](docs/ETAPA1_RUNBOOK.md) | Roles y deploy Stage 1 (cerrado) |
| [`docs/MIGRACIONES_SUPABASE.md`](docs/MIGRACIONES_SUPABASE.md) | Convención de migraciones |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Convenciones y checklist de PR |
| [`docs/COMPONENTES_UI.md`](docs/COMPONENTES_UI.md) | Patrones UI |
| Documentos en `docs/` con prefijos PLAN_/AUDITORIA_ históricos | Archivados / no vigentes |

## BCyP (release rápido)

**Build → Commit → Push:** antes de subir cambios importantes: `npm run build` tiene que pasar, luego `git commit` y `git push`. En equipo, conviene que **CI** (GitHub Actions) ejecute lint + test + build en cada PR (`.github/workflows/ci.yml`).

## PWA y offline

- Service Worker (Serwist) en **producción**; en desarrollo suele estar desactivado.
- Ruta **`/~offline`**: página si no hay red después de cargar la app instalada. El catálogo en sí necesita conexión para leer Supabase.

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

El `manifest.json` espera en `public/` los archivos `icon-192.png`, `icon-512.png` y `apple-touch-icon.png`. Si tenés `logo_icon.png`, ejecutá `npm run pwa-icons` para copiarlo con esos nombres (o generá tamaños exactos con [realfavicongenerator.net](https://realfavicongenerator.net/)). Sin esos archivos la PWA puede dar 404 al instalar.

## Backup y exportación

- **Desde la app:** En el dashboard (Inicio), el botón **Exportar datos** permite descargar productos, ventas, clientes y gastos en **CSV** o **JSON**. Podés elegir “todo” o filtrar ventas y gastos por período. Los gastos exportados son solo los del usuario logueado.
- **Desde Supabase:** En el [Dashboard de Supabase](https://supabase.com/dashboard) → tu proyecto → **Database** → **Backups** podés usar los backups automáticos. Para un export manual de tablas: **Table Editor** → elegir tabla → **Export** (CSV), o usar el **SQL Editor** con `COPY ... TO STDOUT` / herramientas externas (pg_dump con la connection string del proyecto).

## Deploy

Compatible con [Vercel](https://vercel.com). **Único proyecto autorizado:** `ilara`
(`prj_l1212uETlGghvn8jChfiXCp68SzN`) → https://ilara.com.ar. El nombre `ilara-app`
es solo del package npm y de Supabase, no un destino Vercel. Ver
[`docs/VERCEL_PROYECTO_AUTORIZADO.md`](docs/VERCEL_PROYECTO_AUTORIZADO.md).
