# Auditoría del proyecto Ilara Beauty

## 1. Lo que está bien

- **Stack actual:** Next.js 16, React 19, TypeScript, Supabase, Tailwind v4, PWA.
- **App Router:** Rutas claras (`/`, `/login`, `/catalogo`, `/gastos`), layout único con metadata y viewport.
- **Auth:** Middleware con Supabase SSR protege rutas; raíz sin usuario va a catálogo; `/login` y `/catalogo` públicas.
- **Tipado:** Tipos en `lib/supabase.ts` y `lib/types.ts`; `strict: true` en `tsconfig`.
- **Estilo:** Variables en `globals.css`, diseño consistente (rosa/outfit), componentes reutilizables (`PastelCard`, `Toast`).
- **Servicios:** `expenseService`, `saleService` con validación y códigos de error coherentes.
- **Documentación:** README y `DEPLOY_VERCEL_PASO_A_PASO.md` útiles para setup y deploy.

---

## 2. Seguridad

| Punto | Estado | Recomendación |
|-------|--------|----------------|
| Variables de entorno | OK | `.env` en `.gitignore`; no subir nunca `SUPABASE_SERVICE_ROLE_KEY`. |
| RLS en Supabase | No revisado en código | Asegurar en Supabase que `expenses`, `sales`, etc. tengan RLS por `auth.uid()`. |
| `SUPABASE_SERVICE_ROLE_KEY` en API | Correcto | Solo en servidor; no exponer al cliente. |
| `.env.example` | Revisar | Documentar en README y en `.env.example` las variables necesarias para producción. |

---

## 3. Rutas y auth

- **Middleware:** Define bien públicas vs protegidas.
- **Doble chequeo de auth:** En `app/gastos/page.tsx` y `app/page.tsx` se hace `getUser()` en cliente además del middleware. No es un error, pero:
  - Si confiás 100% en el middleware, el `getUser()` en cliente sirve sobre todo para no mostrar contenido sensible antes del redirect.
  - Si en algún momento hubiera una ruta que el middleware no cubra, ese chequeo extra ayuda. Opción: dejar como está o documentar que el middleware es la fuente de verdad.

---

## 4. Configuración y assets

- **Manifest PWA** (`public/manifest.json`): Referencia `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`. Esos archivos no están en el repo (solo `logo_icon.png`). En producción puede dar 404 al instalar la PWA.  
  **Sugerencia:** Generar esos iconos desde `logo_icon.png` o apuntar el manifest a `/logo_icon.png` para las rutas que lo permitan (según soporte de tamaños).
- **Favicon:** Ya configurado en `layout.tsx` con `logo_icon.png`.
- **next.config:** PWA con `next-pwa`; imágenes de Supabase en `remotePatterns`. Correcto.

---

## 5. Código y mantenibilidad

- **Catalogo.tsx (~775 líneas):** Componente muy grande (estado, efectos, handlers, listas, modales).  
  **Sugerencia:** Extraer por ejemplo: `BadgeRotator`, lógica del carrito (custom hook `useCarrito`), modales (carrito, confirmación, imagen previa) en componentes o hooks. Mejora tests y lectura.
- **Toast:** `removeToast` no se pasa en el `Provider` al `Toast`; en el código actual se usa `onClose={removeToast}` y el toast se cierra por timer o por el botón. Revisar que ningún toast quede colgado (por ejemplo si `duration` es 0 o no se limpia el timer). Por lo que vi, está bien usado.
- **Consistencia:** Mezcla de español e inglés en nombres (ej. `getSaludo` vs `getUser`). No es bloqueante; si querés homogeneizar, definir "idioma" de la API interna (por ejemplo todo en inglés) y mantener español en UI/strings.

---

## 6. UX y accesibilidad

- **Toasts:** El botón de cerrar no tiene `aria-label` (ej. `"Cerrar"`). Añadirlo mejora accesibilidad.
- **Catálogo:** Hay `aria-label` en el botón del logo. Revisar que filtros, botones de "Agregar" y modales tengan labels o texto visible para lectores de pantalla.
- **Loading:** Hay estados de carga ("Cargando Ilara...", "Cargando productos..."). Bien para evitar pantallas en blanco.

---

## 7. Errores y resiliencia

- No hay **Error Boundary** global. Si un componente lanza en render, Next.js muestra el error por defecto.  
  **Sugerencia:** Añadir `app/error.tsx` (y opcionalmente `global-error.tsx`) para capturar errores y mostrar un mensaje amigable en español.
- En servicios y API se usa `console.error` y en muchos casos `showToast('error', ...)`. Está bien; podrías en algún momento centralizar mensajes de error (por ejemplo por código de error de Supabase) para no repetir textos.

---

## 8. Performance

- **Imágenes:** Uso de `next/image` en catálogo con `sizes` razonables. Dominio de Supabase en `remotePatterns`. Bien.
- **Logo:** `logo_icon.png` en public es grande (~1.3 MB). Para favicon/iconos PWA conviene tener versiones reducidas; para la UI del header podría valer la pena una versión más liviana.
- **Bundle:** Un solo `Catalogo.tsx` muy grande puede afectar el chunk inicial del catálogo. Lazy de modales o de secciones pesadas (por ejemplo el grid de productos) podría ayudar si medís que el catálogo es lento.

---

## 9. Resumen de acciones sugeridas (prioridad)

1. **Alta:** Documentar `SUPABASE_SERVICE_ROLE_KEY` en README y en `.env.example` (aunque el valor no se copie).
2. **Alta:** Resolver iconos PWA: crear `icon-192.png` / `icon-512.png` (y opcional `apple-touch-icon.png`) o apuntar el manifest a assets existentes.
3. **Media:** Añadir `app/error.tsx` (y si querés, `global-error.tsx`) para manejo de errores en español.
4. **Media:** Refactorizar `Catalogo.tsx` (hooks + componentes más chicos) para mantener el mismo comportamiento.
5. **Baja:** Añadir `aria-label` al botón de cerrar del Toast y revisar a11y en catálogo (botones/filtros).
6. **Baja:** Revisar en Supabase que RLS esté bien configurado en todas las tablas que usan `user_id` o equivalente.
