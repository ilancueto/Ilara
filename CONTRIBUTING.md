# Contribuir a Ilara App

Gracias por interesarte en Ilara. La aplicación nació para acompañar el emprendimiento de Mara y sigue creciendo con su uso diario. Ilan mantiene el código. Si querés ayudar, no hace falta empezar con una funcionalidad grande: una explicación más clara o un error bien documentado también ayudan.

## Por dónde empezar

1. Leé el [README](README.md) y la [guía para otro comercio](docs/ADAPTAR_A_OTRO_COMERCIO.md).
2. Para un cambio grande, abrí primero una issue contando el problema y tu propuesta.
3. Para un error, incluí pasos para reproducirlo, resultado esperado, versión de Node y capturas con datos ficticios cuando ayuden.
4. En el PR explicá qué cambia y cómo lo verificaste. Si no pudiste correr una comprobación, decilo.

Son bienvenidas mejoras en documentación, accesibilidad, instalación y configuración de marca. No tenemos una promesa de tiempos de respuesta ni una hoja de ruta cerrada para una versión genérica.

## Datos de prueba

Usá tu propio Supabase y datos ficticios. Las pruebas de integración y E2E modifican datos y requieren staging separado de producción: [guía de pruebas](docs/SUPABASE_CLOUD_TESTS.md). Los forks no reciben los secretos del repositorio original; los jobs de nube requieren configurar sus propios secretos.

Los workflows `operations-monitor.yml` y `expire-catalog-payments.yml` apuntan al negocio real de Ilara. En un fork, deshabilitalos antes de habilitar Actions; para usar sus funciones, revisá primero sus dominios y configurá los secretos de tu propia instalación.

Si encontrás una vulnerabilidad o una credencial expuesta, evitá publicarla en una issue. Contactá al mantenedor en `ilan.cueto@ilara.com.ar`, sin enviar contraseñas ni datos de clientes.

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
