# Contribuir a Ilara App

## Convenciones de código (C4)

| Ámbito | Convención |
|--------|------------|
| **UI / textos visibles** | Español (Argentina u ortografía que elijas de forma consistente). |
| **Código** | Nombres de variables, funciones, archivos y tipos en **inglés** (`getUser`, `saleService`, `Producto` como tipo puede quedar por histórico). |
| **React** | Componentes en PascalCase; hooks con prefijo `use`. |
| **Commits** | Mensajes claros; opcional [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`). |

## Antes de abrir PR

1. `npm run lint`
2. `npm run test`
3. `npm run build`

Ver **BCyP** en `README.md` (Build → Commit → Push) para releases.

## Supabase

- No commitear **service role** ni secretos.
- Cambios de esquema: preferir `supabase/migrations/` con timestamp y subir el SQL a producción alineado al código.
