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

- Node.js 18+
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

Obtener valores en: Supabase Dashboard → Settings → API

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
| `npm run pwa-icons` | Copiar `logo_icon.png` a iconos PWA |

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

Compatible con [Vercel](https://vercel.com). Configurar las variables de entorno en el dashboard del proyecto.
