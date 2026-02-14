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
└── middleware.ts     # Protección de rutas (auth)
```

## Rutas

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/` | Autenticado | Dashboard, inventario, ventas, gastos, clientes |
| `/login` | Público | Inicio de sesión |
| `/catalogo` | Público | Catálogo para compartir con clientes |
| `/gastos` | Autenticado | Gestión de gastos (vista ampliada) |

## Deploy

Compatible con [Vercel](https://vercel.com). Configurar las variables de entorno en el dashboard del proyecto.
