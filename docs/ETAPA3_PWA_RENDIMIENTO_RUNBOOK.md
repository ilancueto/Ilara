# Etapa 3 — PWA instalable online-only y rendimiento

- **Alcance:** implementación local en repo `ilara-app`
- **Fecha de implementación local:** 2026-08-11
- **Producción:** **no** verificada en este runbook (sin deploy en esta tarea)
- **Vercel autorizado:** solo proyecto `ilara` (`prj_l1212uETlGghvn8jChfiXCp68SzN`)

## 1. Estrategia elegida

**PWA instalable + 100 % online.**

| Pieza | Elección |
|---|---|
| Manifest | `public/manifest.json` — `display: standalone`, `start_url: /`, `scope: /` |
| Iconos | PNG con dimensiones reales (192, 512, maskable 512, apple 180) |
| Service worker | `public/sw.js` estático mínimo, versionado en git |
| Registro | `components/PwaRegister.tsx` en el layout raíz |
| Offline | **No soportado** a propósito |
| Caché SW | **Ninguna** (activate borra todo CacheStorage) |
| Build PWA | Sin Serwist / Workbox / webpack plugin |

### Por qué permite instalación sin offline

1. Chromium/Android exige manifest válido (nombre, iconos 192+512, `start_url`,
   `display` standalone/fullscreen/minimal-ui) y un service worker con listener
   `fetch` para considerar la app “installable”.
2. El listener `fetch` de Ilara **no** llama a `respondWith`: el navegador usa la
   red normal. No hay shell offline, ni fallback, ni CacheStorage de documentos.
3. Next.js 16 documenta que se pueden ofrecer prompts de instalación sin soporte
   offline (`node_modules/next/dist/docs/.../progressive-web-apps.md`).
4. iOS “Añadir a pantalla de inicio” usa manifest + apple-touch-icon; el SW no es
   el factor principal, pero tampoco introduce offline.

### Alternativas descartadas

| Alternativa | Motivo de descarte |
|---|---|
| Conservar Serwist con precache/runtime | Offline no deseado; cacheaba Supabase REST; warning Turbopack; `/sw.js` no se publicaba (gitignore + disable dev) |
| Serwist “sin runtime cache” | Aporta poco frente a un SW de ~50 líneas; sigue siendo capa build compleja |
| Solo manifest sin SW | Puede bastar en algunos escritorios recientes, pero falla criterios de instalación Android/Chromium que aún miran el SW + `fetch` |
| Offline “catálogo de solo lectura” | Contradice decisión de negocio y riesgo de datos obsoletos / stock falso |

## 2. Comportamiento de red e instalación

### Instalación

- Desde `/` o `/catalogo` (ambas cargan el layout con `PwaRegister`).
- Chromium: menú “Instalar aplicación” / `beforeinstallprompt` según heurísticas.
- Android Chrome: añadir a pantalla de inicio con icono 192/512/maskable.
- iOS Safari: Compartir → Añadir a pantalla de inicio (apple-touch-icon 180).
- Tras instalar: ventana standalone; **siempre** requiere red.

### Actualización del SW

- `skipWaiting` en install + `clientsClaim` en activate.
- Header `Cache-Control: no-cache, no-store, must-revalidate` en `/sw.js`.
- Registro con `updateViaCache: 'none'`.
- `PwaRegister` llama `registration.update()` cada hora y al volver a la pestaña.
- Workers en `waiting` reciben `SKIP_WAITING`.

### Limpieza de caches legacy

En `activate`, el SW ejecuta `caches.keys()` + `caches.delete` de **todas** las
claves. Eso elimina residuos de Serwist/Workbox/`ilara-supabase-catalog` en
clientes que ya tenían un SW antiguo, en la primera visita post-deploy.

### Sin conexión

- Navegación y `fetch` fallan como web normal.
- No se crean ventas, no hay cola, no hay Background Sync, no hay IndexedDB de
  mutaciones, no se muestra stock/catálogo “congelado” desde CacheStorage del SW.
- La ruta `/~offline` es solo informativa **online** (“requiere internet”); el SW
  no redirige allí.

## 3. Rendimiento (mediciones locales sanitizadas)

### Antes (diagnóstico Stage 3)

| Área | Observación |
|---|---|
| PWA | `/sw.js` ausente en build/prod; Serwist + Turbopack warning |
| Iconos | `icon-512.png` real 308×117; `icon-192` era 512×512 mal etiquetado |
| Catálogo | `revalidate=60` anulado por `cookies()` en cliente server |
| Deps | Cadena Serwist/workbox en build |

### Después (repo local)

| Área | Cambio |
|---|---|
| PWA | `public/sw.js` versionado; registro cliente; 0 warning Serwist |
| Iconos | 192/512/180/maskable reales; tamaños ~6–30 KB PNG |
| Catálogo | `createSupabasePublicClient()` sin cookies → ISR viable |
| Fuentes | `display: "swap"` Outfit/Fraunces |
| Deps | `-28` paquetes (Serwist tree); `npm audit` 0 |

**No** se afirma Lighthouse de producción. Medición local (Lighthouse mobile,
`localhost:3000/catalogo` sobre `next start`, post-cambios Stage 3):

| Métrica | Valor local (sanitizado) |
|---|---|
| Performance score | ~0.81 |
| FCP | ~2.2 s |
| LCP | ~4.5 s (imágenes remotas de catálogo dominan; no refactor visual Stage 3) |
| CLS | 0 |
| TBT | ~90 ms |
| Speed Index | ~3.1 s |

ISR local en `/catalogo`: `x-nextjs-cache: HIT`, `Cache-Control: s-maxage=60`.
HTTP local: `/sw.js` 200 + `no-cache`; `/manifest.json` 200; iconos 200 PNG.

## 4. Verificación local

```bash
npm run check:pwa-icons
npm run lint
npx tsc --noEmit --incremental false
npm run test
npm run build
# con servidor: npm run start  (o dev) + Playwright
npm run test:e2e -- e2e/pwa.spec.ts
```

Checks HTTP esperados (local o prod tras deploy):

| URL | Esperado |
|---|---|
| `/manifest.json` | 200, JSON, `display: standalone` |
| `/sw.js` | 200, JavaScript, sin `respondWith` / `caches.open` |
| `/icon-192.png` etc. | 200, `image/png`, dimensiones correctas |

## 5. Rollback

1. Revertir el commit Stage 3 (restaura Serwist solo si se revirtiera el árbol
   completo; no recomendado).
2. Mínimo: eliminar registro (`PwaRegister`), borrar o vaciar `public/sw.js`, y
   desplegar — los clientes dejarán de actualizar el SW; usuarios pueden
   desinstalar la PWA manualmente.
3. No hay migraciones SQL en Stage 3.

## 6. Limitaciones por plataforma

| Plataforma | Notas |
|---|---|
| Chrome Android | Criterio SW+fetch+manifest; install prompt según engagement |
| Chrome desktop | Similar; a veces requiere interacción del usuario |
| Safari iOS | A2HS manual; SW limitado; sin `beforeinstallprompt` |
| Firefox | Manifest + install variable según versión/OS |

## 7. Vercel

- Único destino: proyecto **`ilara`**.
- Un push a `main` → un deployment `Production – ilara`.
- No crear/enlazar `ilara-app` en Vercel (`ilara-app` = npm + Supabase only).
- Preflight: leer `.vercel/project.json` → `projectName=ilara` y Project ID exacto.

## 8. Qué NO hace Stage 3

- Offline, Background Sync, colas, IndexedDB de mutaciones.
- Cache de Supabase, sesión, panel, POS o comprobantes en el SW.
- Cambios de RLS/SQL/Auth/Storage.
- Deploy, commit o push (fuera del alcance de la sesión de implementación si así
  se acordó).
