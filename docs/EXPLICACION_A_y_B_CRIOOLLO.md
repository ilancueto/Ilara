# A y B explicados en criollo

> **Estado repo:** lógica y SQL de **A** (RPC ventas, storage receipts, docs de migraciones/RLS) y guías de **B** están en el código; falta **aplicar la migración** `20260313210000_*` en tu proyecto Supabase producción cuando subas este release.

## Bloque A – Base de datos y Supabase

- **A1 – Migraciones en producción**  
  El código ya espera columnas nuevas (`catalog_badge`, `visible_in_catalog`, fotos múltiples, etc.). Si en Supabase **no** corrés los SQL del repo, al guardar productos o usar el panel puede fallar o ignorar datos. **En criollo:** subí a producción los mismos cambios de tablas que tenés en `supabase/migrations/` (o los scripts viejos que uses), así el código y la DB hablan el mismo idioma.

- **A2 – Revisar RLS**  
  RLS son las **reglas de quién puede leer/escribir qué** en cada tabla. Si el script del repo dice una cosa y en el dashboard tenés otra, alguien podría ver datos de más o no poder guardar. **En criollo:** cada tanto compará las políticas del proyecto Supabase con `supabase/sql/supabase_rls_all.sql` / migraciones y anotá diferencias.

- **A3 – “Más vendidos” en el catálogo**  
  Para ordenar por ventas, la app (a veces sin login) necesita **números agregados** de ventas. Si la tabla `sale_items` no es legible para usuarios anónimos de forma segura, ese orden queda en **cero** o inventado. **En criollo:** o abrís una **vista**/`RPC` que solo devuelva totales por producto (sin datos sensibles), o aceptás que “más vendidos” no sea real hasta hacerlo bien.

- **A4 – Bucket `receipts`**  
  Ahí suben comprobantes de ventas. Si el bucket es muy abierto, cualquiera con el link ve el archivo. **En criollo:** revisá que no se pueda **listar** todo el bucket; que solo quien tenga el link (o sesión) acceda; y límites de tamaño/tipo de archivo.

- **A5 – Migraciones ordenadas**  
  Tenés SQL sueltos en la raíz y otros en `migrations/`. En un entorno nuevo es fácil aplicar en orden incorrecto. **En criollo:** definí **un solo camino** (por ejemplo solo carpeta `migrations/` con fecha en el nombre) y documentalo, para no romper un deploy nuevo.

- **A6 – Hostname de imágenes en `next.config`**  
  Hoy puede estar el host de Supabase **fijo**. Si cambiás de proyecto o tenés otro storage, el build se queja. **En criollo:** meter el host en variable de entorno y usarla en `remotePatterns` para no tocar código cada vez.

---

## Bloque B – Seguridad y dependencias

- **B1 – `npm audit`**  
  NPM te marca paquetes con vulnerabilidades conocidas. Muchas son del **build** (PWA, webpack), no del usuario final. **En criollo:** corrés `npm audit` / `npm audit fix`; lo que no se arregle sin romper versiones, lo anotás y evaluás actualizar a mediano plazo.

- **B2 – Serwist / cadena PWA**  
  El service worker y herramientas de empaquetado a veces arrastran dependencias viejas. **En criollo:** no siempre hay fix sin cambiar de librería; seguí changelog de Serwist/Next y planificá upgrade si el riesgo te molesta.

- **B3 – CSP más estricta**  
  La app ya manda políticas de contenido; hoy permite cosas como `unsafe-eval` para que no se rompa nada. **En criollo:** apretar CSP (menos `unsafe-*`) hay que probarlo **en staging** porque puede romper Supabase, fuentes o scripts.

- **B4 – Passkeys / Edge Function**  
  Si usás login con passkey, la función en edge tiene límites y validaciones de origen. **En criollo:** revisá logs en Supabase, rate limits, y que el dominio de producción esté bien configurado en WebAuthn.
