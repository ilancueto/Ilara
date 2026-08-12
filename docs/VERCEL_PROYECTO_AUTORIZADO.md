# Vercel — único proyecto autorizado

**Regla crítica.** Cualquier operación de deploy o CLI de Vercel debe
cumplirla. Si no se cumple, **detenerse sin modificar nada**.

## Destino válido

| Campo | Valor |
|---|---|
| Nombre del proyecto | `ilara` |
| Project ID | `prj_l1212uETlGghvn8jChfiXCp68SzN` |
| Owner / equipo | Ilara |
| Producción | https://ilara.com.ar |

## Nombres que NO son un proyecto Vercel

| Nombre | Uso legítimo |
|---|---|
| `ilara-app` | Proyecto **Supabase** (`qbbnvdmadgomfmrsfxlo`) y `package.json` (`name`) |
| `ilara-app` | **No** es destino Vercel. Un proyecto duplicado con ese nombre ya se eliminó porque desplegaba el mismo repo en paralelo y generaba errores por correo. |

## Preflight obligatorio (antes de cualquier comando Vercel)

1. Leer `.vercel/project.json`.
2. Exigir `projectName === "ilara"`.
3. Exigir `projectId === "prj_l1212uETlGghvn8jChfiXCp68SzN"`.
4. Si no coincide → **parar** (no link, no deploy, no create).
5. **Prohibido:**
   - `vercel link` (salvo que el owner lo pida explícitamente y el target sea `ilara`)
   - `vercel project add` / importaciones automáticas
   - crear o re-crear un proyecto llamado `ilara-app`
6. Un push a `main` debe producir **un solo** deployment de producción: **Production – ilara**.
7. Tras el push, comprobar en GitHub Deployments que **no** exista `Production – ilara-app`.

## Estado verificado del enlace local

Archivo `.vercel/project.json` (no commitear secretos; el project link es de workspace):

```json
{
  "projectId": "prj_l1212uETlGghvn8jChfiXCp68SzN",
  "projectName": "ilara"
}
```

Si este archivo falta o apunta a otro proyecto, no improvisar un link nuevo a
`ilara-app`. Coordinar con el owner para re-enlazar **solo** a `ilara`.
