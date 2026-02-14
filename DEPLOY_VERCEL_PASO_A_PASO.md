# Deploy en Vercel – Paso a paso (desde cero)

Guía para subir tu proyecto Ilara a internet usando Vercel, sin experiencia previa.

---

## Qué vas a necesitar

- Tu proyecto **ilara-app** (ya lo tenés).
- Cuenta en **GitHub** (gratis) – para guardar el código en la nube.
- Cuenta en **Vercel** (gratis) – para publicar la app.
- Las variables de **Supabase**: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (las tenés en tu `.env.local`).

---

## Parte 1: Subir el código a GitHub

Vercel despliega desde un repositorio de Git. Primero hay que tener el proyecto en GitHub.

### 1.1 Crear cuenta en GitHub (si no tenés)

1. Entrá a [https://github.com](https://github.com).
2. Clic en **Sign up** y creá una cuenta (email + contraseña).
3. Confirmá el email si te lo piden.

### 1.2 Instalar Git en tu PC (si no lo tenés)

1. Entrá a [https://git-scm.com/download/win](https://git-scm.com/download/win).
2. Descargá **Windows** y ejecutá el instalador (siguiente, siguiente).
3. Cerrá y volvé a abrir la terminal o Cursor cuando termine.

### 1.3 Crear un repositorio nuevo en GitHub

1. En GitHub, arriba a la derecha: clic en el **+** → **New repository**.
2. **Repository name:** por ejemplo `ilara-app`.
3. Dejalo **Public**.
4. **No** marques “Add a README” (ya tenés código local).
5. Clic en **Create repository**.

Te va a mostrar una página con una URL tipo:  
`https://github.com/TU_USUARIO/ilara-app.git`  
Dejá esa página abierta.

### 1.4 Abrir terminal en la carpeta del proyecto

En Cursor:

- Menú **Terminal** → **New Terminal**  
  (o atajo `` Ctrl+` ``).

Asegurate de estar en la carpeta del proyecto. Escribí:

```bash
cd c:\Users\ilaan\ilara-app
```

(Enter.)

### 1.5 Inicializar Git y hacer el primer “commit”

Copiá y pegá estos comandos **uno por uno** (Enter después de cada uno):

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Primer commit - Ilara listo para deploy"
```

Si te pide configurar nombre/email la primera vez:

```bash
git config --global user.email "tu@email.com"
git config --global user.name "Tu Nombre"
```

Y volvé a:

```bash
git add .
git commit -m "Primer commit - Ilara listo para deploy"
```

### 1.6 Conectar con GitHub y subir el código

En la página del repo que creaste en GitHub vas a ver algo como “push an existing repository from the command line”. Usá la **primera** URL (HTTPS), que se ve así:

`https://github.com/TU_USUARIO/ilara-app.git`

En la terminal (reemplazá `TU_USUARIO` y `ilara-app` por tu usuario y nombre del repo si son distintos):

```bash
git remote add origin https://github.com/TU_USUARIO/ilara-app.git
```

```bash
git branch -M main
```

```bash
git push -u origin main
```

Te va a pedir **usuario y contraseña de GitHub**.  
- Usuario: tu usuario de GitHub.  
- Contraseña: ya **no** se usa la contraseña normal; tenés que usar un **Personal Access Token**:
  1. En GitHub: **Settings** (de tu cuenta, arriba a la derecha) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
  2. **Generate new token (classic)**. Poné un nombre (ej. “ilara deploy”) y elegí que no expire (o 90 días).
  3. Marcá el permiso **repo**.
  4. **Generate token** y **copiá el token** (solo se muestra una vez).
  5. En la terminal, cuando pida password, **pegá ese token** (no se va a ver mientras pegás).

Si todo va bien, al final vas a ver que “pushed” a `main`. Refrescá la página del repo en GitHub y deberías ver todos tus archivos.

---

## Parte 2: Deploy en Vercel

### 2.1 Crear cuenta en Vercel

1. Entrá a [https://vercel.com](https://vercel.com).
2. Clic en **Sign Up**.
3. Elegí **Continue with GitHub** (así Vercel se conecta a tu cuenta de GitHub).
4. Autorizá a Vercel para acceder a tus repositorios (podés dar acceso solo a “ilara-app” si querés).

### 2.2 Crear un proyecto nuevo

1. En el dashboard de Vercel, clic en **Add New…** → **Project**.
2. En la lista de repositorios, buscá **ilara-app** (o el nombre que hayas puesto).
3. Clic en **Import** al lado de ese repo.

### 2.3 Configurar el proyecto

En la pantalla de configuración:

- **Framework Preset:** debería decir **Next.js** (Vercel lo detecta solo). No lo cambies.
- **Root Directory:** dejalo vacío (por defecto usa la raíz del repo).
- **Build Command:** `npm run build` (ya viene así).
- **Output Directory:** vacío (Next.js lo maneja solo).

No hagas clic en Deploy todavía.

### 2.4 Agregar las variables de entorno

Sin estas variables la app no puede hablar con Supabase. Tenés que cargarlas en Vercel.

1. En la misma pantalla, buscá la sección **Environment Variables**.
2. Abrí tu archivo **`.env.local`** en la carpeta del proyecto (en Cursor, en la raíz de ilara-app). Ahí tenés algo como:
   - `NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...`

3. En Vercel, agregá **dos variables**:

   **Variable 1**
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** pegá la URL completa de Supabase (la que está en `.env.local`).
   - **Environment:** marcá Production (y Preview si querés que también funcione en “preview” deploys).

   **Variable 2**
   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** pegá la clave anon completa de Supabase (la que está en `.env.local`).
   - **Environment:** Production (y Preview si querés).

4. Clic en **Add** por cada una. Deberías ver las dos en la lista.

### 2.5 Hacer el deploy

1. Clic en **Deploy**.
2. Vercel va a construir el proyecto (1–2 minutos). Vas a ver los logs en pantalla.
3. Si termina bien, te muestra **Congratulations!** y una URL tipo:
   - `https://ilara-app-xxxxx.vercel.app`

Esa URL es tu app publicada. Abrila en el navegador: deberías ver la pantalla de login de Ilara.

---

## Parte 3: Probar que todo funcione

1. Entrá a la URL que te dio Vercel.
2. Deberías ver la pantalla de **Login**.
3. Iniciá sesión con el mismo usuario que usás en local (el que tenés en Supabase).
4. Revisá que puedas entrar al dashboard, inventario, ventas, gastos, clientes.
5. Si algo no carga (ej. “Error al cargar”), revisá que las dos variables de entorno en Vercel estén bien copiadas (sin espacios de más, sin saltos de línea).

---

## Parte 4: Actualizar la app después (cuando cambies código)

Cada vez que quieras subir cambios:

1. En Cursor, en la terminal (en la carpeta `ilara-app`):

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

2. Vercel detecta el push a GitHub y hace un **nuevo deploy** solo. En el dashboard de Vercel ves el estado (Building → Ready). La misma URL sigue funcionando con la versión nueva.

---

## Resumen rápido

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | GitHub | Crear cuenta y crear repo “ilara-app”. |
| 2 | PC (terminal) | `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`. |
| 3 | Vercel | Cuenta con GitHub → Add Project → Import “ilara-app”. |
| 4 | Vercel | Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| 5 | Vercel | Deploy. Copiar la URL y probar login. |
| 6 | Futuro | Cambios: `git add .` → `git commit` → `git push` y Vercel redeploya solo. |

---

## Si algo falla

- **Build failed:** Revisá el log en Vercel (el mensaje en rojo). Si dice algo de “env” o “undefined”, volvé a agregar las dos variables y hacé **Redeploy** (en el proyecto → Deployments → los tres puntitos del último deploy → Redeploy).
- **Página en blanco o “Error”:** Casi siempre es que faltan o están mal las variables de Supabase. Revisá nombres exactos: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Login no funciona:** Mientras uses el mismo proyecto de Supabase que en local, debería funcionar. Si creaste otro proyecto de Supabase, tenés que usar las variables de ese proyecto en Vercel.

Si querés, en el siguiente mensaje contame en qué paso estás y qué ves en pantalla y te guío desde ahí.
