# Plan de mejoras y optimizaciones – Ilara App

Documento para decidir qué implementar y en qué orden. Cada ítem indica esfuerzo estimado y prioridad sugerida.

---

## 1. Correcciones / crítico

### 1.1 Excluir Service Worker del middleware
**Problema:** El middleware actual no excluye `/sw.js` ni rutas de Serwist. En producción, usuarios no logueados (ej. en `/catalogo`) pueden ser redirigidos al intentar cargar el SW, y el PWA no se registra bien.

**Qué hacer:** En `middleware.ts`, ampliar el `matcher` para no ejecutar middleware en:
- `/sw.js`
- Rutas que use Serwist (ej. `swe-worker`, `~offline` si aplica)

**Esfuerzo:** Bajo (cambio en una regex/config).  
**Prioridad:** Alta.

- [x] Implementar

---

## 2. Configuración y DX

### 2.1 Script de lint completo
**Situación:** `package.json` tiene `"lint": "eslint"` sin argumentos; no revisa archivos del proyecto.

**Qué hacer:** Usar por ejemplo `"lint": "next lint"` o `"eslint ."` (y opcionalmente `"lint:fix": "next lint --fix"`).

**Esfuerzo:** Muy bajo.  
**Prioridad:** Media.

- [x] Implementar

### 2.2 Silenciar warnings en desarrollo
**Situación:** Warning de Serwist con Turbopack y/o múltiples lockfiles.

**Qué hacer:**
- Añadir en `.env.local`: `SERWIST_SUPPRESS_TURBOPACK_WARNING=1`
- Opcional: en `next.config.ts` configurar `turbopack.root` para el warning de lockfiles

**Esfuerzo:** Muy bajo.  
**Prioridad:** Baja.

- [x] Implementar

---

## 3. Robustez al arranque

### 3.1 Validación de variables de entorno
**Problema:** Si faltan `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`, el error aparece tarde y es poco claro.

**Qué hacer:** Crear un módulo (ej. `lib/env.ts`) que al importarse valide las env necesarias (con `zod` o comprobaciones manuales) y lance con mensaje claro si falta algo. Usarlo en el cliente de Supabase y/o en un punto único de entrada.

**Esfuerzo:** Bajo.  
**Prioridad:** Media.

- [x] Implementar

---

## 4. UX y rendimiento

### 4.1 Loading states por ruta
**Situación:** No hay `loading.tsx` en rutas; la transición entre páginas puede sentirse lenta.

**Qué hacer:** Añadir `loading.tsx` en rutas principales (ej. `app/catalogo/loading.tsx`, `app/login/loading.tsx`, `app/gastos/loading.tsx`, etc.) con un spinner o skeleton acorde al diseño.

**Esfuerzo:** Bajo–medio (una plantilla reutilizable por ruta).  
**Prioridad:** Media.

- [x] Implementar

### 4.2 Lazy loading de pantallas pesadas
**Situación:** Pantallas como Inventario, Historial de ventas, Punto de venta cargan todo de una.

**Qué hacer:** Usar `next/dynamic` con `loading` para esas rutas o secciones, o envolver bloques en `<Suspense>` para no bloquear todo el shell.

**Esfuerzo:** Medio.  
**Prioridad:** Baja (solo si se nota lentitud).

- [x] Implementar

### 4.3 Análisis de bundle
**Situación:** No se ve qué paquetes pesan más en el build.

**Qué hacer:** Añadir `@next/bundle-analyzer` (o el analyzer que use tu versión de Next) y un script `npm run analyze` para revisar el bundle y decidir lazy-load o code-splitting.

**Esfuerzo:** Bajo.  
**Prioridad:** Baja.

- [x] Implementar

---

## 5. Tests

### 5.1 Ampliar tests unitarios
**Situación:** Hay tests en `lib/__tests__`; falta cobertura en lógica de negocio (ventas, inventario, gastos, etc.).

**Qué hacer:** Identificar servicios/utilidades críticas (ej. en `lib/`) y añadir tests (cálculos, formateo, reglas de stock, etc.).

**Esfuerzo:** Medio–alto.  
**Prioridad:** Media.

- [x] Implementar

### 5.2 Ampliar E2E
**Situación:** Playwright configurado; pocos o ningún flujo E2E de negocio.

**Qué hacer:** Añadir E2E para flujos clave: abrir catálogo, login, una venta, alta de producto, etc., según lo que consideres crítico.

**Esfuerzo:** Alto.  
**Prioridad:** Media–baja (según necesidad de regresiones).

- [x] Implementar

---

## 6. Seguridad (opcional)

### 6.1 Content-Security-Policy (CSP)
**Situación:** No hay CSP; los headers actuales (X-Frame-Options, etc.) ya ayudan.

**Qué hacer:** Si en el futuro querés endurecer más, definir un header CSP en `next.config.ts` teniendo en cuenta dominios de Supabase, Vercel Analytics, etc., e ir ajustando según reportes de consola.

**Esfuerzo:** Medio (requiere tuning).  
**Prioridad:** Baja.

- [x] Implementar

---

## 7. Futuro Next.js

### 7.1 Migrar middleware → proxy
**Situación:** Next depreca el archivo `middleware` en favor de “proxy”.

**Qué hacer:** Cuando Next documente la migración, reemplazar la lógica actual de `middleware.ts` por la nueva convención (proxy) sin cambiar el comportamiento (rutas públicas, redirecciones, auth).

**Esfuerzo:** Depende de la API final.  
**Prioridad:** Baja hasta que la deprecación sea inminente.

- [ ] Implementar

---

## Resumen por prioridad

| Prioridad | Ítems |
|-----------|--------|
| **Alta** | 1.1 Excluir SW del middleware |
| **Media** | 2.1 Lint completo, 3.1 Validación env, 4.1 Loading states, 5.1 Tests unitarios |
| **Baja** | 2.2 Warnings, 4.2 Lazy loading, 4.3 Bundle analyzer, 5.2 E2E, 6.1 CSP, 7.1 Proxy |

Cuando decidas con qué avanzar, se puede ir marcando cada ítem y trabajando en ese orden.
