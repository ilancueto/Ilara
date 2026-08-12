# Plan de implementaciÃ³n por etapas â€” Ilara

- **Fecha de planificaciÃ³n:** 9 de agosto de 2026
- **Fuente:** [`AUDITORIA.md`](./AUDITORIA.md)
- **Estado:** propuesto para ejecuciÃ³n
- **Horizonte tÃ©cnico estimado:** 3 a 5 semanas para una persona dedicada
- **Unidad de esfuerzo:** dÃ­a-persona, sin incluir funcionalidades nuevas de negocio

## 1. Objetivo y reglas de ejecuciÃ³n

El objetivo es cerrar primero los riesgos que pueden comprometer cuentas, datos o
dinero; despuÃ©s recuperar confiabilidad operativa y reciÃ©n entonces ampliar el
producto. El orden de las etapas es deliberado y no debe invertirse.

Reglas de trabajo:

1. NingÃºn cambio de seguridad se aplica directamente en producciÃ³n sin una
   migraciÃ³n o artefacto versionado, salvo contenciÃ³n de emergencia. Si hubiera
   una acciÃ³n manual urgente, debe reproducirse inmediatamente en una migraciÃ³n.
2. Todo cambio de Supabase se prueba primero en local o staging, incluyendo
   `anon`, usuario autenticado permitido y usuario autenticado no permitido.
3. Para cada tabla expuesta se verifican por separado: esquema expuesto, `GRANT`,
   RLS y columnas accesibles. Ninguno de esos controles sustituye a los otros.
4. Las migraciones se crean con la CLI instalada y su comando vigente; no se
   inventan nombres ni timestamps manualmente.
5. Antes de desplegar una migraciÃ³n se ejecutan advisors, lista de migraciones,
   pruebas de autorizaciÃ³n y un respaldo verificable.
6. No se copian secretos, correos, nombres de clientes ni comprobantes a tickets,
   logs de CI o documentos.
7. Cada cambio debe tener criterios de aceptaciÃ³n, rollback operativo y una
   persona revisora distinta de quien lo implementa cuando sea posible.
8. Los checks globales mÃ­nimos son lint, TypeScript, unitarios, build y E2E
   aplicables. Un build verde no reemplaza las pruebas de autorizaciÃ³n.

## 2. Roles sugeridos

| Rol | Responsabilidad |
|---|---|
| Responsable tÃ©cnico | ImplementaciÃ³n, PR, migraciones y coordinaciÃ³n de deploy |
| Responsable de base | Revisar RLS, grants, funciones, Storage, advisors y backups |
| Responsable de negocio | Decidir reglas de precios, acceso por rol y polÃ­ticas comerciales |
| Revisor/QA | Ejecutar criterios de aceptaciÃ³n y guardar evidencia sin datos sensibles |
| Responsable de incidente | Revisar logs, alcance de exposiciÃ³n y rotaciÃ³n de credenciales |

En un equipo pequeÃ±o una persona puede cubrir varios roles, pero la decisiÃ³n de
precios y la aceptaciÃ³n del riesgo residual deben pertenecer al negocio.

## 3. Resumen de etapas

| Etapa | Plazo orientativo | Resultado | Bloquea la siguiente |
|---|---:|---|---|
| 0. ContenciÃ³n | 0â€“24 horas | Cerrar toma de cuentas y lectura anÃ³nima sensible | SÃ­ |
| 1. Seguridad e integridad | 3â€“5 dÃ­as | Reconstruir auth, precios y transacciones | SÃ­ |
| 2. Gobierno de datos | 4â€“6 dÃ­as | Base reproducible, tipada y verificable | SÃ­ |
| 3. PWA y rendimiento | 3â€“5 dÃ­as | PWA instalable online-only + catÃ¡logo ISR | No |
| 4. Calidad operativa | 5â€“8 dÃ­as | E2E, a11y, observabilidad y recuperaciÃ³n | No |
| 5. Arquitectura incremental | 5â€“10 dÃ­as | Reducir deuda sin reescritura | No |
| 6. Producto | Roadmap posterior | Pedidos, stock, devoluciones y reportes | No |

## 4. Etapa 0 â€” ContenciÃ³n inmediata

**Estado (2026-08-12): CERRADA Y VERIFICADA EN PRODUCCIÃ“N.**

- **Objetivo:** reducir el riesgo activo sin esperar refactors ni rediseÃ±os.
- **CondiciÃ³n de inicio:** acceso a Supabase, Vercel y logs de producciÃ³n.
- **CondiciÃ³n de salida:** todos los criterios de la secciÃ³n 4.7 cumplidos.

### 4.1 Preparar ventana y evidencia

- [x] Responsable tÃ©cnico y aprobaciÃ³n de negocio confirmados durante la ventana.
- [x] Logs de Supabase y Vercel revisados durante preflight y post-deploy.
- [x] Backup estructural pre-Stage 1 creado y localizado.
- [x] Cambios de contenciÃ³n versionados en commits acotados sobre `main` por
  decisiÃ³n del propietario.
- [x] Matriz aislada con dos cuentas locales y smoke productivo con las dos cuentas
  reales.

**Entregable:** registro privado de incidente con timestamps y responsables, sin
datos personales copiados.

### 4.2 Contener passkeys â€” SEC-01

Orden recomendado:

1. Hacer que la Edge Function rechace temporalmente las rutas de passkey con una
   respuesta controlada.
2. Ocultar o desactivar el botÃ³n en login y mostrar acceso por contraseÃ±a.
3. Confirmar que el login tradicional y recuperaciÃ³n de cuenta siguen funcionando.
4. Revisar usuarios y credenciales passkey creados desde el despliegue de la
   funciÃ³n; no eliminarlos sin preservar evidencia y evaluar sesiones activas.

Checklist:

- [x] Registro de passkey no disponible en producciÃ³n (403 `PASSKEYS_DISABLED`).
- [x] Login por passkey retirado de UI y descartado por decisiÃ³n de negocio.
- [x] Login por contraseÃ±a verificado con las dos cuentas reales.
- [x] Respuestas de la Edge Function no incluyen secretos ni informaciÃ³n de
  existencia de correos (respuesta fija `PASSKEYS_DISABLED`).

**Rollback:** volver a la versiÃ³n anterior de la UI solamente si la Edge Function
continÃºa bloqueada; no reactivar el flujo vulnerable para recuperar comodidad.

### 4.3 Cerrar exposiciÃ³n anÃ³nima â€” SEC-02

Separar la correcciÃ³n en dos cambios desplegables:

**Cambio A: ventas**

- [x] Inventariar polÃ­ticas y grants efectivos de `sales` y `sale_items`. *(versionado en repo + migraciones stage0)*
- [x] Revocar acceso directo de `anon` y eliminar polÃ­ticas pÃºblicas obsoletas
  (aplicado; probe productivo 401).
- [x] Mantener Ãºnicamente el RPC agregado requerido por el orden del catÃ¡logo,
  con retorno mÃ­nimo y sin nombres, notas, pagos, usuarios ni comprobantes. *(reafirmado en `stage0_harden_catalog_sales_rpc`)*
- [x] Verificar que el RPC no sea `SECURITY DEFINER` pÃºblico sin comprobaciones y
  que tenga `search_path` fijo si necesita privilegios elevados. *(search_path=public; REVOKE PUBLIC; GRANT solo anon/authenticated)*

**Cambio B: catÃ¡logo de productos**

- [x] Definir el DTO pÃºblico: identificador, nombre, descripciÃ³n pÃºblica, precio
  de venta, descuento, imÃ¡genes, categorÃ­a, badge y disponibilidad estrictamente
  necesaria. *(`lib/catalog/publicCatalogSelect.ts`)*
- [x] Excluir precio de compra, notas internas, stock mÃ­nimo, auditorÃ­a y cualquier
  otro dato operativo. *(cÃ³digo + grants de migraciÃ³n `stage0_public_catalog_column_grants`)*
- [x] Reemplazar `select('*')` y `products(*)` por columnas explÃ­citas. *(hooks + serverCatalog)*
- [x] Revocar el privilegio general y conceder sÃ³lo columnas pÃºblicas (aplicado;
  `purchase_price` anÃ³nimo devuelve 401).
- [x] Mantener RLS para decidir quÃ© productos/combos son visibles. *(polÃ­ticas reafirmadas en migraciÃ³n)*

**Secuencia para evitar caÃ­da del catÃ¡logo:** desplegar primero el cliente con
selecciÃ³n explÃ­cita y la nueva superficie pÃºblica; validarla; reciÃ©n despuÃ©s
revocar la superficie antigua.

### 4.4 Proteger comprobantes â€” STO-01

- [x] Bucket `receipts` confirmado privado en producciÃ³n.
- [x] Privacidad aplicada mediante migraciÃ³n versionada.
- [x] Aplicar polÃ­ticas por prefijo/propietario y prohibir listado anÃ³nimo. *(en migraciÃ³n)*
- [x] Servir descargas mediante URL firmada de corta duraciÃ³n. *(TTL 300s en `receiptStorage`)*
- [x] LÃ­mites de tamaÃ±o y MIME verificados en bucket y aplicaciÃ³n.
- [x] Comprobante real verificado: URL firmada autorizada y acceso directo anÃ³nimo
  denegado.

### 4.5 Evaluar y rotar secretos â€” SEC-03

- [x] El propietario confirmÃ³ que ZIP, `passsupa.txt` y pooler permanecieron
  totalmente privados y nunca salieron del equipo.
- [x] RotaciÃ³n de Supabase descartada para este incidente: no hubo exposiciÃ³n.
- [x] RotaciÃ³n de pooler descartada por la misma evaluaciÃ³n.
- [x] InvalidaciÃ³n de tokens Vercel no requerida por este incidente.
- [x] Purga coordinada no requerida; exclusiones preventivas permanecen activas.
- [x] AÃ±adir `supabase/.temp/`, ZIPs y respaldos a las exclusiones apropiadas.
- [x] Mantener `.env.example` sin valores y usar el gestor de secretos del entorno. *(sin cambios de valores; runbook en `docs/RUNBOOK_ROTACION_SECRETOS.md`)*

**Nota:** borrar el archivo actual no elimina copias, historial, caches o clones.

### 4.6 Corregir JSON-LD â€” SEC-04

- [x] Escapar `<` como `\\u003c` antes de insertar el JSON-LD. *(`serializeJsonLd`)*
- [x] AÃ±adir una prueba con nombre/notas que contengan `</script>`.
- [x] Verificar que el resultado siga siendo JSON-LD vÃ¡lido. *(tests unitarios)*
- [x] CorrecciÃ³n desplegada y cubierta por prueba.

### 4.7 Gate de salida de contenciÃ³n

La etapa 0 termina Ãºnicamente cuando:

- [x] Una peticiÃ³n anÃ³nima a `sales` devuelve 401.
- [x] Una peticiÃ³n anÃ³nima a `sale_items` devuelve acceso denegado o cero
  superficie.
- [x] Una peticiÃ³n anÃ³nima no puede solicitar `purchase_price`, notas internas ni
  campos de auditorÃ­a de productos.
- [x] El catÃ¡logo pÃºblico sigue mostrando productos, combos y orden agregado.
- [x] NingÃºn comprobante puede abrirse sin autorizaciÃ³n o URL firmada vÃ¡lida.
- [x] Passkeys estÃ¡n desactivadas definitivamente y contraseÃ±a funciona.
- [x] JSON-LD resiste el payload hostil de prueba. *(en repo; smoke HTML post-deploy recomendado)*
- [x] DecisiÃ³n documentada: artefactos privados, sin exposiciÃ³n ni rotaciÃ³n.

## 5. Etapa 1 â€” Seguridad e integridad del negocio

**Estado (2026-08-12): CERRADA Y VERIFICADA EN PRODUCCIÃ“N.** El nÃºcleo de
autorizaciÃ³n, precios, ventas, stock y receipts fue validado. DATA-03 y el lifecycle
ampliado de archivos permanecen como backlog explÃ­cito para etapas posteriores.

**Objetivo:** reconstruir las funciones desactivadas y asegurar que toda venta
tenga un resultado autoritativo y consistente.

### 5.1 Passkeys â€” SEC-01

- [x] DecisiÃ³n de negocio: Ilara no utilizarÃ¡ passkeys.
- [x] UI retirada y Edge Function contenida globalmente con 403 fijo.
- [x] Helpers y tablas sin superficie directa para `anon`/`authenticated`.
- [x] DiseÃ±o v2 conservado Ãºnicamente como referencia histÃ³rica; no forma parte
  del roadmap activo ni del gate de cierre.

### 5.2 Formalizar autorizaciÃ³n â€” AUTH-01

- [x] Roles: `admin`, `vendedor`, `none` (`docs/ETAPA1_ROLES_Y_PRECIOS.md`).
- [x] Tabla `user_roles` + helpers DEFINER (`search_path=''`) + `set_user_role` (lock + last_admin).
- [x] `bootstrap_first_admin(uuid)` solo **service_role**, lock 87201411, sin autoclaim en UI.
- [x] RLS por rol; `user_roles_select_admin` reafirmada tras 21412; sin DELETE directo ventas.
- [x] RPC POS DEFINER endurecido; payment_breakdown estricto; vendedor sin UPDATE products.
- [x] Frontend UX por rol; **no** es fuente de autorizaciÃ³n.
- [x] Tests de secuencia de migraciones + integraciÃ³n (fail si STAGE1=1 incompleto; skip si off).
- [x] Preflight 21412 preserva las policies anon del catÃ¡logo Stage 0; delete venta usa lock de fila.
- [x] DecisiÃ³n de negocio: no asignar `vendedor` en el corto/mediano plazo; el rol
  queda dormido y la superficie POS reducida se difiere hasta que vaya a utilizarse.
- [x] MigraciÃ³n 20260812002815 revoca grants heredados peligrosos, helpers internos
  pÃºblicos y la policy amplia de actualizaciÃ³n de recibos.
- [x] Roles productivos: dos cuentas `admin`, cero `vendedor` (2026-08-12).
- [x] RevisiÃ³n de seguridad pre-deploy y advisors ejecutados tras migrar Supabase.

### 5.3 Unificar precios del POS â€” DATA-01

DecisiÃ³n de negocio (documentada en repo):

- [x] **OpciÃ³n A:** POS cobra precio de lista; descuento web solo catÃ¡logo.
- [x] Combos: `combos.sale_price`; histÃ³rico en `sale_items.unit_price/subtotal`.
- [x] RPC recalcula total e ignora `unit_price`/`total`/`product_name`/descuentos del cliente.
- [x] Valida status, payment_method, breakdown (mixto, suma, mÃ©todos, montos > 0).
- [x] Devuelve `sale` + `lines` autoritativos; UI/comprobante usan respuesta RPC.
- [x] Preview UI alineada (`totalCarritoPos` / `precioLista*`).
- [x] Rechaza `line_type` invÃ¡lido, precios catÃ¡logo â‰¤ 0, productos inexistentes; qty enteras > 0.
- [x] Smoke autenticado en producciÃ³n con las dos cuentas admin: login, venta,
  precio, stock, eliminaciÃ³n y comprobante correctos.

Criterio de aceptaciÃ³n:

- [x] Implementado en migraciones/app en repositorio.
- [x] RevisiÃ³n humana y smoke productivo completados.
- [x] Validado con las dos cuentas reales post-deploy.

### 5.4 Transacciones de inventario â€” DATA-03

**Backlog no bloqueante del cierre Stage 1; trasladado a arquitectura/calidad.**

- [ ] Crear RPC transaccional para actualizar combo y todos sus Ã­tems.
- [ ] Validar componentes existentes, cantidades positivas y combo no vacÃ­o.
- [ ] Convertir visibilidad/badges masivos a una operaciÃ³n por lote.
- [ ] Para borrados masivos, devolver Ã©xitos/fallos explÃ­citos o usar atomicidad
  segÃºn la decisiÃ³n de negocio.
- [ ] AÃ±adir pruebas de rollback ante un componente invÃ¡lido.

### 5.5 Ciclo de vida de archivos â€” STO-01

**Privacidad cerrada; lifecycle ampliado trasladado a calidad operativa.**

- [ ] Centralizar validaciÃ³n de MIME, extensiÃ³n y tamaÃ±o.
- [ ] Usar nombres no predecibles y rutas por propietario/entidad.
- [ ] Eliminar el objeto nuevo si falla la persistencia de su entidad.
- [ ] Eliminar el objeto anterior despuÃ©s de confirmar un reemplazo.
- [ ] AÃ±adir tarea segura de detecciÃ³n de huÃ©rfanos con modo dry-run.

### 5.6 Gate de salida de etapa 1

- [x] Passkeys fuera de alcance por decisiÃ³n de negocio; contenciÃ³n 403 verificada.
- [x] Matriz de autorizaciÃ³n aprobada y smoke productivo completado.
- [x] Tests unitarios/estructurales de roles y precios en CI local.
- [x] Matriz Stage 0 + Stage 1: 25/25 sobre instancia local restaurada desde el
  esquema productivo, sin datos de usuarios.
- [x] Venta, stock, eliminaciÃ³n y receipt verificados con cuentas reales en producciÃ³n.
- [x] DATA-03 transferido explÃ­citamente al backlog; no pertenece al nÃºcleo cerrado.
- [x] Privacidad STO-01 verificada; lifecycle ampliado transferido a Stage 4/5.

## 6. Etapa 2 â€” Gobierno y reproducibilidad de datos

**Estado (2026-08-12): COMPLETADO, DESPLEGADO Y VERIFICADO.** Stage 0/1 no se
reabrieron.

**Objetivo:** poder crear, auditar y recuperar el entorno sin scripts manuales ni
estado oculto en el dashboard.

### 6.1 Consolidar migraciones â€” DATA-02

- [x] Inventariar objetos de `supabase/sql`, `supabase/migrations` y producciÃ³n.
  *(`docs/STAGE2_INVENTORY.md`)*
- [x] Elegir un baseline que reconstruya tablas, constraints, Ã­ndices, funciones,
  triggers, grants, RLS, Storage y datos de referencia no sensibles.
  *(`20250101000000_baseline_core_schema.sql` completo para greenfield; no reescribe
  historial remoto ya aplicado)*
- [x] Marcar scripts manuales histÃ³ricos como archivados; no borrarlos hasta
  validar el baseline. *(`supabase/sql/README.md`)*
- [x] Crear una base vacÃ­a y ejecutar el flujo completo desde cero.
  *(`supabase db reset --local` incluye Stage 0 + 1 + 2)*
- [x] Comparar el resultaÛÛh‘éì¶»§q«^t[8¡¤œ›ÙXØÚpìÛˆ[ˆÛÛÈXİ\˜HH]YY0ìÂˆØİ[Y[YÈ[™\ÚYX[šYÚ[ÜÙ\šX[HY˜][š]š[YÙ\ÊJ‚‹HŞHZ™Xİ]\ˆYš\ÛÜœÈHÛ\ÚYšXØ\ˆØ\›š[™ÜÈHÙYİ\šYYÜ\™›Ü›X[˜ÙK‚ˆ
ŠØØ[İYÙHˆÙXİ\š]HØ\›‹Ù\œ›ÜˆH’ÜÈÚ[ˆ0ë[™XÙNÈÜİYÛÛœÙ\˜BˆØ\›š[™ÜÈ™]š[ÜËÚ[[˜Ú[Û˜[\ÈH”ÈQ’S‘TˆH›İXØÚpìÛˆHÛÛ˜\ÙpìX\Èš[˜Y\ÊJ‚‹HŞHİX\™\ˆ]šY[˜ÚXHHZYÜ˜][Ûˆ\İØØ[H™[[İË‚ˆ
Š[X›ÜÈ[[™XYÜÈ\İHŒŒLŒLÎLLØ
J‚‚ˆÈÈÈ‹Œˆ\ÜÈH˜[YXÚpìÛ‚‚‹HŞHÙ[™\˜\ˆ\ÜÈ\TØÜš\\ÙH[\Ü]Y[XH™\œÚ[Û˜YË‚ˆ
Š\\ËÙ]X˜\ÙK™Ù[™\˜]YØœH[ˆ\\Ø
J‚‹HÈH[[Z[˜\ˆÜ˜YX[Y[H\ÜÈX[X[\È\XØYÜÈHØ\İÈ\ÙH[šÛ›İÛ˜‚ˆ
Š[™[\šXYÜÎÈ™Y˜XİÜˆX\Ú]›ÈY\˜HH[Ø[˜ÙHİYÙHŠJ‚‹HÈHpìXY\ˆ˜[YXÚpìÛˆH^[ØYÈ[ˆÙ\™\ˆXİ[ÛœË›İ]H[™\œÈH0ë[Z]\ÈBˆ”ÎÈ›ÈÛÛ™šX\ˆğìÛÈ[ˆ\ÜÈHÛÛ\[XÚpìÛ‹ˆ
ŠY™\šYÈHØ[YYØ\œ]Z]Xİ\˜JJ‚‹HŞH™\œÚ[Û˜\ˆ[ÛÛX[™ÈH™YÙ[™\˜XÚpìÛˆHÛÛ\›Ø˜\ˆY™ˆ[ˆÒK‚ˆ
Š\\Ø\\Î˜ÚXÚØ›Øˆ‹\ÙXİ\š]X
J‚‚ˆÈÈÈ‹ŒÈYX˜\ÈHÙYİ\šYYH˜\ÙH[ˆÒB‚‹HŞH]˜[\ˆİ\X˜\ÙHØØ[È[ˆİYÚ[™ÈY°ë[Y\›Ë‚‹HŞH\XØ\ˆÙ\È\ÈZYÜ˜XÚ[Û™\È\ÙHÙ\›Ë‚‹HŞHZ™Xİ]\ˆX]š^ˆHXØÙ\ÛÈ[›Û˜È›Û\È]][XØYÜÈÈÙ\šXÙH›ÛK‚ˆ
ŠØÜš\ËÙ‹\ÙXİ\š]K[X]š^›ZœØÈ›Û\È]]°ëXHİZ]HİYÙHJJ‚‹HŞH›Ø˜\ˆÛÛ[[˜\È0î˜›XØ\Ë™[\ËÛY[\ËØ\İÜËÛÛ\›Ø˜[\ÈH”Ë‚‹HŞH˜[\ˆÒHÚH[˜HX›H^Y\İHØ\™XÙHH“ÈÈÜ˜[ÈXÛ\˜YÜË‚ˆ
ŠØÜš\ËØÚXÚË\›ËXÛİ™\˜YÙK›ZœØ
J‚‹HŞHZ™Xİ]\ˆYš\ÛÜœÈHÛÛœÙ\˜\ˆ[ˆ™\ÜHØ[š]^˜YË‚ˆ
ŠØÜËÑUTL—Ô•S“ÓÒË›Y
ÈÛ\ÚYšXØXÚpìÛˆYš\ÛÜœÊJ‚‚ˆÈÈÈ‹Ø]HHØ[YHH]\H‚‚‹HŞHİ\X˜\ÙHˆ™\Ù]È›Z›È\]Z]˜[[H™XÛÛœİ^YH[[Ü››Ëˆ
ŠØØ[
J‚‹HŞH›È]YY[ˆØ[Xš[ÜÈH\Ü]Y[XH\XØYÜÈğìÛÈ\ÙH\Ú›Ø\™‚ˆ
ŠY]›ÜÈØ[Xš[ÜÈ™\œÚ[Û˜YÜÎÈ™\ÚYX[\İ0ìÜšXÛÈØİ[Y[YÊJ‚‹HŞH\ÜÈÙ[™\˜YÜÈÛÚ[˜ÚY[ˆÛÛˆ[\Ü]Y[XKˆ
ŠÚXÚÈØØ[
J‚‹HŞHÒH]XİH[˜HÛ0ë]XØH[°ìÛš[XH\›Z\Ú]˜H[›ÙXÚYH[X™\˜Y[Y[H[ˆ[˜BˆYX˜HHÛÛ›Ûˆ
ŠœH[ˆ\İ™‹Z[œÙXİ\™KXÛÛ›Û
J‚‹HŞH\ŞHHŒŒLŒLÎLLØ[ˆ›ÙXØÚpìÛˆ
ÈÛ[ÚÙH›È]][K‚ˆ
ŠÚ][ËØØ]0è[ÙÛÈŒÈ™[\ËØØ[\ÜÈ[\››ÜÈ[›ÛˆNÈ\ÜÚÙ^\ÈÊJ‚‚ˆÈÈËˆ]\HÈ8 %ĞHH™[™[ZY[Â‚ŠŠ‘\İYÈ
ØØ[Œ‹LLLJNˆSTSQS•QHSˆ‘TÈ8 %[™Y[H\ŞKÜÛ[ÚÙH›ÙŠŠ‚‚ŠŠ‘XÚ\ÚpìÛˆH™YÛØÚ[ÈYš[š]]˜NŠŠˆĞH[œİ[X›H
XÛÛ›Ëİ[™[Û™K\[ZÙJBŠŠœÚ[ŠŠˆ[˜Ú[Û˜[ZY[ÈÙ™›[™KˆÚ[ˆ™XØXÚKÚ[ˆ[[YHØXÚHH0èYÚ[˜\ËĞTKÂ”İ\X˜\ÙKÜÙ\ÚpìÛ‹Ú[ˆÛÛ\ÈšH™[\ÈÙ™›[™Kˆ™\‚–ØØÜËÑUTL×ÔĞWÔ‘S‘SRQS•×Ô•S“ÓÒË›YJ‹ÙØÜËÑUTL×ÔĞWÔ‘S‘SRQS•×Ô•S“ÓÒË›Y
K‚‚ˆÈÈÈËŒH™\\˜\ˆĞH8 %ĞKLB‚‹HŞH™]\˜\ˆÙ\Ú\İ
Ù\Ú\İÛ™^Ù\Ú\İ\ÜİËØÜ˜\\ˆ[‚ˆ™^˜ÛÛ™šYËØ
H8 %[˜ÛÛ\]Xš[YY\˜›ÜXÚÈHÙ™›[™H›È\ÙXYË‚‹HŞHÙ\šXÙHÛÜšÙ\ˆ\İ0è]XÛÈpë[š[[ÈX›XËÜİËšœØˆ[œİ[ØXİ]˜]K[\Y^˜HBˆØXÚTİÜ˜YÙHYØXŞK™]Ú\İ[™\ˆ
ŠœÚ[ŠŠˆ™\ÜÛ™Ú]
™]ÛÜšË[Û›JK‚‹HŞH™YÚ\İ›ÈÛY[HÛÛ\Û™[ËÔØT™YÚ\İ\‹Ş[ˆ^[İ]˜pë^‹‚‹HŞHXÛÛ›ÜÈ™X[\ÎˆNL°åÌNL‹LL°åÍLL‹X\ÚØX›HLL‹\K]İXÚNˆ
œH[ˆØKZXÛÛœØÈÚXÚÎœØKZXÛÛœØ
K‚‹HŞHX[šY™\İ\Ü^Nˆİ[™[Û™X[YHÙ™™XØÛÜHØİ\İ\›Ø‚‹HŞHXY\œÈØXÚKPÛÛ›Ûˆ›ËXØXÚX\˜HÜİËšœØ‚‹HŞH\İÈ[š]\š[ÜÈ
ÈL‘HĞNÈØÜš\ÚXÚÎœØKZXÛÛœØ‚‹HÈHÛ[ÚÙHÜÙ\ŞNˆÜİËšœØŒ™YÚ\İ›ÈÕËÚ[ˆ›ÙXİ[Ûˆ8 $È[\˜KX\[‚ˆ™\˜Ù[Ú[ˆØXÚ\ÈÙ\Ú\İ[ˆÛY[\È^\İ[\È˜\Èš\Ú]K‚‚ˆÈÈÈËŒˆ™Xİ\\˜\ˆØXÚH[Ø]0è[ÙÛÈ8 %T‘‹LB‚‹HŞHÛY[H0î˜›XÛÈX‹Üİ\X˜\ÙKÜX›XËØ
ŠœÚ[ŠŠˆÛÛÚÚY\Ê
X‚‹HŞHØ]0è[ÙÛÈ\İYÈH\Ø[ˆÈ0î˜›XÛÈ
ĞUSÑ×Ê—ÔÑSPÕ
H°ëXHÛY[Bˆ0î˜›XÛË‚‹HŞH™]˜[Y]XHØ]0è[ÙÛËÔZ˜HH[[\œÙHÜˆÛÛÚÚY\ÎÈ\ÈšXÚ\Âˆš\ÚX›\ÈÙH™\™[™\š^˜[ˆÛÛˆÙ[™\˜]Tİ]XÔ\˜[\Ø
TÔˆšXX›JK‚‹HÈH[˜[YXÚpìÛˆÛ‹Y[X[™ÜˆYÜÈ[]]\ˆ›ÙXİÜÈ
˜XÚÛÙÈÜÚ[Û˜[İYÙH
ÊK‚‹HŞHYYXÚpìÛˆØØ[Øİ[Y[YH[ˆ[˜›ÛÚÈİYÙHÈ
[\ËÙ\Üpê\ÈØ[š]^˜YÊK‚‚ˆÈÈÈËŒÈÜ[Z^˜XÚpìÛˆYYYB‚‹HŞH\Ü^NˆœİØ\˜[ˆY[\Èİ]š]Ñœ˜][˜Ù\È
Ô^ÊK‚‹HŞHXÛÛ›ÜÈĞH™YXÚYÜÈHXÙ[˜\ÈHĞˆ[˜ÛÜœ™XİÜÈH‘È[Y[œÚ[Û˜YÜË‚‹HŞH[[Z[˜XÚpìÛˆHÙ\Ú\İ[[™HHZ[
Y[›ÜÈ\ÈHÚ[ˆØ\›š[™È\˜›ÜXÚÊK‚‹HÈHÛÛ[]š\ÚXš[]XÈ[™H[˜[^™\ˆ›Ù[™È8¡¤ˆ˜XÚÛÙÈİYÙH8 $ÍHÚH^Bˆ]šY[˜ÚXHH™YÜ™\ÚpìÛ‹‚‹HÈHš]\İTÓHØ\›š[™È™\ÚYX[8¡¤ˆ›È›Ü]YX[HİYÙHË‚‚ˆÈÈÈËØ]HHØ[YHH]\HÂ‚‹HŞHÜš]\š[ÜÈØØ[\Îˆ[œİ[X›H
X[šY™\İ
ÔÕÊÚXÛÛ›ÜÊKÚ[ˆÙ™›[™HH™YÛØÚ[ËˆÚ[ˆØXÚH\Ôİ\X˜\ÙH[ˆÕËZ[Ú[ˆÙ\Ú\İÕ\˜›ÜXÚÈØ\›š[™ÈĞK‚‹HÈH\ŞHH™\˜Ù[›ŞYXİÈ
Š˜[\˜X
Šˆ0î›šXØ[Y[H
ÈÛ[ÚÙH›Ù‚‹HŞHØ]0è[ÙÛÈ0î˜›XÛÈÚ[ˆÛÛÚÚY\Ê
X[ˆ™]ÚH]ÜË‚‹HŞHÕÈ›ÈØXÚXH]][XØYÈšHÛÛ\›Ø˜[\È
›ÈØXÚXH˜YHH\
K‚‚ˆÈÈˆ]\H8 %Ø[YYÜ\˜]]˜B‚ˆÈÈÈŒHL‘HHÒH8 %TÕLB‚‹HÈH[œİ[\ˆ˜]™YØYÜ™\È^]ÜšYÚ[ˆÒHÛÛˆØXÚHÛÛ\]X›K‚‹HÈHXİX[^˜\ˆ[Û[ÚÙH\İ[[˜ØX™^˜YÈ[Ø]0è[ÙÛË‚‹HÈHİXœš\ˆÙÚ[‹]]Üš^˜XÚpìÛ‹™[KİØÚËÛÛX›ÜËØ\İÜËÛÛ\›Ø˜[\ËˆØ\œš]Ëİ\0ìÛ‹Ú]Ğ\ĞHH[Øš[K‚‹HÈH\Ø\ˆ]ÜÈHYX˜HZ\ÛYÜÈH[\Y^˜H]\›Z[š\İK‚‹HÈHZ™Xİ]\ˆ[\ÜË[š]\š[ÜË[YÜ˜XÚpìÛ‹L‘HHZ[[ˆØYH‹‚‹HÈHpìXY\ˆÛ[ÚÙH\İÈÜÙ\ŞH\˜HØ]0è[ÙÛËÙÚ[‹XY\œÈHÙ\šXÙHÛÜšÙ\‹‚‚ˆÈÈÈŒˆØœÙ\˜Xš[YY8 %Ğ”ËLB‚‹HÈH[YÜ˜\ˆÙ[KÜ[•[[Y]HÈ\]Z]˜[[H[ˆÛY[KÙ\šYÜˆHYÙBˆ[˜İ[ÛœË‚‹HÈHYš[š\ˆØ[š]^˜XÚpìÛˆHRHHÙXÜ™]ÜÈ[\ÈH[šX\ˆ]™[ÜË‚‹HÈHpìXY\ˆÛÜœ™[][Û‹Ü™\]Y\İQH\œ›Ü™\È\İXİ\˜YÜË‚‹HÈHÜ™X\ˆ[\\È\˜H˜[ÜÈHÙÚ[‹”ÈH™[KİÜ˜YÙHH\œ›Ü™\È^‚‹HÈH™YÚ\İ˜\ˆpê]šXØ\ÈH™YÛØÚ[È0êXÛšXØ\ÈÚ[ˆ]ÜÈ\œÛÛ˜[\Îˆ™[\È˜[Y\ËˆÛÛ™›XİÜÈHİØÚË][˜ÚXHH\ØHH\œ›Ü‹‚‹HÈHØİ[Y[\ˆ[˜›ÛÚÜÈ\˜HØYH[\K‚‚ˆÈÈÈŒÈXØÙ\ÚXš[YY8 %LLVKLB‚‹HÈHÜ™X\ˆ[ˆÛÛ\Û™[HX[ÙÈ0î›šXÛÈÛÛˆ›Øİ\È˜\\ØØ\K™\İ]\˜XÚpìÛˆBˆ›ØÛË›Û™È[™\KØÜ›ÛØÚÈHX™[Ë‚‹HÈHZYÜ˜\ˆ\ÜÚÙ^\ËØ\İÜË[™[\š[Ë™[\ÈHÛÛ™š\›XXÚ[Û™\Ë‚‹HÈHİ\İ]Z\ˆ]ˆÛÛXÚØÜˆ›İÛ™\ËÙ[›XÙ\ÈÙ[pè[XÛÜË‚‹HÈHİ\İ]Z\ˆÛÛ™š\›J
XÜˆpè[ÙÛÈXØÙ\ÚX›HH\İXX›K‚‹HÈHZ™Xİ]\ˆ^HH™XÛÜœšYÈğìÛÈÛÛˆXÛYÈ[ˆ\ÚİÜÛ[Øš[K‚‚ˆÈÈÈ™Xİ\\˜XÚpìÛˆHÜ\˜XÚpìÛ‚‚‹HÈHYš[š\ˆ”ÈH•ÈÛÛˆ™YÛØÚ[Ë‚‹HÈH]]ÛX]^˜\ˆ˜XÚİ\YXÚ[Û˜[ÚH[[ˆHİ\X˜\ÙHÈ™\]ZY\™K‚‹HÈHZ™Xİ]\ˆ[˜H™\İ]\˜XÚpìÛˆÛÛ\]H[ˆ[Ü››ÈZ\ÛYË‚‹HÈHØİ[Y[\ˆ\ŞK›Û˜XÚË›İXÚpìÛˆHÙXÜ™]ÜÈH™\ÜY\İHH[˜ÚY[\Ë‚‹HÈHpìXY\ˆ0èYÚ[˜HH\İYÜÈ[šY›Ü›Y\ÈH\œ›Ü‹Ü™Z[[Ë‚‚ˆÈÈÈHØ]HHØ[YHH]\H‚‹HÈHÒHÛÛ\]È™\™HHØ›YØ]Üš[È\˜HY\™ÙK‚‹HÈH[\\È›Ø˜Y\ÈYYX[H[ˆ\œ›ÜˆÚ[0ê]XÛË‚‹HÈH›Z›ÜÈš[˜Ú\[\ÈÛÛ\]X›\ÈğìÛÈÛÛˆXÛYË‚‹HÈH™\İ]\˜XÚpìÛˆZ™Xİ]YHHY[\ÈYYYË‚‚ˆÈÈKˆ]\HH8 %\œ]Z]Xİ\˜H[˜Ü™[Y[[‚ŠŠ“Øš™]]›ÎŠŠˆ™YXÚ\ˆ]YHÚ[ˆ[˜H™Y\ØÜš]\˜H]YHÛ™ØH[ˆšY\ÙÛÈHÜ\˜XÚpìÛ‹‚‚‹HÈHÜ™X\ˆ[˜HSÙ\™\‹[Û›X\˜HÜ\˜XÚ[Û™\ÈÙ[œÚX›\ÈH]]Üš^˜XÚpìÛˆÙ\˜ØBˆHHY[HH]ÜË‚‹HÈHÙ\\˜\ˆÛY[H0î˜›XÛÈHØ]0è[ÙÛËÛY[Hœ›İÜÙ\ˆ]][XØYÈHÛY[BˆÙ\™\‹\ÚYK‚‹HÈHÜ™Ø[š^˜\ˆÜˆpìÙ[ÜÈ™\XØ[\Îˆ™[\Ë[™[\š[ËÛY[\ËØ\İÜÈBˆØ]0è[ÙÛË‚‹HÈH^˜Y\ˆš[Y\›È0ìÙÚXØH\˜HHÙ\šXÚ[ÜÈHÜÈÛÛ\Û™[\ÈX^[Ü™\ÈHŒˆ0ë[™X\ÎÈX[[™\ˆœÈ\]Ypì[ÜË‚‹HÈHYš[š\ˆÛÛ˜]ÜËÑÈH]š]\ˆ[YY\ÈH˜\ÙHÛÛ\]\È[ˆHRK‚‹HÈHÙ[˜[^˜\ˆX[™Z›ÈH\œ›Ü™\ËØY[™Ë›Ü›][\š[ÜÈHÛÛ™š\›XXÚ[Û™\Ë‚‹HÈHpìXY\ˆÙ\™\‹[Û›XHpìÙ[ÜÈ]YH][XÙ[ˆÙXÜ™]ÜÈÈ]ÜÈ[\››ÜË‚‹HÈHXİX[^˜\ˆ‘PQQHH›ÙHLŒKŒH[›^˜\ˆğìÛÈ\İH]Y]Ü°ëXHH\İH[‚ˆÛÛ[ÈY[\ÈšYÙ[\Ë‚‹HÈHX\˜Ø\ˆ›ØYX\È\İ0ìÜšXÛÜÈÛÛ[È\˜Ú]˜YÜÈ\˜H[[Z[˜\ˆÛÛ˜YXØÚ[Û™\Ë‚‚Üš]\š[ÈHØ[YN‚‚‹HÈHš[™ğî›ˆÙXÜ™]ÈÈÙ\šXÙH›ÛHYYH[˜\ˆ[ˆ[ˆ[™HHÛY[K‚‹HÈHÜÈÛÛ\Û™[\Èš[˜Ú\[\È]YY[ˆÜˆX˜Z›ÈH[ˆ[Xpì[ÈXÛÜ™YÈÈY[™[‚ˆ™\ÜÛœØXš[YY\ÈÛ\˜[Y[HÙ\\˜Y\Ë‚‹HÈHØYHpìÙ[ÈY[™H[Y[›ÜÈYX˜\ÈHİH0ìÙÚXØHÜ°ë]XØK‚‚ˆÈÈLˆ]\Hˆ8 %›ØYX\H›ÙXİÂ‚‘\İH]\HÛÛZY[˜HğìÛÈ\Üpê\ÈHÙ\œ˜\ˆ\È]\\È8 $Ì‹ˆ[Ü™[ˆš[˜[\[™B™H˜[ÜˆÛÛY\˜ÚX[HØ\XÚYYÜ\˜]]˜K‚‚ŒKˆ
Š”YYÜÈ\ÙHØ]0è[ÙÛÎŠŠˆÛÛ™\\ˆ[Ø\œš]ËÕÚ]Ğ\[ˆ[˜HÜ™[ˆÛÛ‚ˆ\İYÜË˜^˜Xš[YYH˜[YXÚpìÛˆHİØÚË‚Œ‹ˆ
Š[\\ÈH™\ÜÚXÚpìÛŠŠˆİØÚÈY[›ÜˆÈYİX[Hpë[š[[ËİYÙ\™[˜ÚXHHÛÛ\˜HBˆ™\ÜÛœØX›HH™\ÛÛXÚpìÛ‹‚ŒËˆ
Š‘]›ÛXÚ[Û™\ÈH›İ\ÈHÜ°êY]ÎŠŠˆ™]™\œÚpìÛˆ˜^˜X›HHYÛÜÈHİØÚÈÚ[‚ˆY]\ˆ™[\È\İ0ìÜšXØ\Ë‚ˆ
Š”™\Ü\ÈHX\™Ù[ŠŠˆ\Ø\ˆ™XÚ[ÈHÛÛ\˜H\İ0ìÜšXÛË\ØİY[ÜÈHÛÜİÜËˆ›ÈğìÛÈ˜Xİ\˜XÚpìÛ‹‚Kˆ
ŠÔ“Hpë[š[[ÎŠŠˆ\İÜšX[]\]Y]\ÈHÛÛœÙ[[ZY[È\˜HØ[\pìX\Ë‚‹ˆ
ŠİY[\ÈÜˆÛØœ˜\‹ÜYØ\ˆHÛÛ˜Ú[XXÚpìÛŠŠˆØ[ÜË™[˜Ú[ZY[ÜÈH\İYÜË‚Ëˆ
ŠŒ‹YÛÜÈÛ›[™HÈ][\İXİ\œØ[ŠŠˆ]˜[X\ˆğìÛÈİX[™ÈHÜ\˜XÚpìÛˆXİX[ˆ[™ØH]]Üš^˜XÚpìÛˆÜ˜[[\ˆHØœÙ\˜Xš[YY‚‚ØYH™X]\™HX™H[˜ÛZ\ˆ[\ÈH\Ø\œ›ÛÎ‚‚‹H\0ìİ\Ú\ÈHpê]šXØHH0ê^]ÎÂ‹H[Ù[ÈH\›Z\ÛÜÎÂ‹H[\XİÈ[ˆİØÚË™XÚ[ÜÈH]Y]Ü°ëXNÂ‹HZYÜ˜XÚpìÛˆ™]™\œÚX›KÙ›ÜØ\™Yš^Â‹HYX˜\ÈH[˜›ÛÚÈÜ\˜]]›Ë‚‚ˆÈÈLKˆ]š\ÚpìÛˆİYÙ\šYH[ˆØ[Xš[ÜËÔ‚‚ŸÜ™[ˆØ[Xš[ÈÛÛ[šYÈŸKKNŸKK_KK_ŸHÑPËXÛÛ[˜Ú[Û‹\\ÜÚÙ^\ËZœÛÛ››Ü]Y[ÈH\ÜÚÙ^\ÈH\ØØ\H”ÓÓ‹SŸˆ‹XÚY\œ™KX[›Û˜Ü˜[ËÔ“ÈH™[\ÈHØ]0è[ÙÛÈ0î˜›XÛÈpë[š[[ÈŸÈÕÔQÑK\™XÙZ\Ë\š]˜]XXÚÙ]š]˜YËÛ0ë]XØ\ÈHT“Èš\›XY\ÈŸÑPË\\ÜÚÙ^\Ë]Œ˜™Y\Ùpì[ÈÛÛ\]ÈH\İÈHÙYİ\šYYŸH•TË\ÜËX]]Üš]]]™K\šXÚ[™Ø™YÛHH™XÚ[ÜÈH”È]]Üš]]]›ÈŸˆ‹X]ÛZXËZ[™[ÜXÛÛX›ÈHÜ\˜XÚ[Û™\ÈX\Ú]˜\È˜[œØXØÚ[Û˜[\ÈŸÈ‹[ZYÜ˜][Û‹X˜\Ù[[™X™\›ÙXÚXš[YY\ÜÈH\İÈH“ÈŸĞK\Ù\Ú\İÙ\šXÙHÛÜšÙ\‹XÛÛ›ÜÈHÛ[ÚÙHÜÙ\ŞHŸHT‘‹\X›XËXØ][ÙËXØXÚXÛY[H0î˜›XÛÈÚ[ˆÛÛÚÚY\ÈHTÔ‹ØØXÚHŸLÔËYL™K[ØœÙ\˜Xš[]KXLL^XÒK˜XÚ[™ËX[ÙÜÈH™Xİ\\˜XÚpìÛˆ‚“›ÈYÜ\\ˆØ[Xš[ÜÈx $Íˆ[ˆ[ˆ0î›šXÛÈˆ™\]ZY\™[ˆ›Û˜XÚÈH˜[YXÚpìÛ‚š[™\[™Y[\Ë‚‚ˆÈÈÈLKŒHÜ™[ˆH\ŞHHÛÛ[˜ÚpìÛˆ
]\H
B‚‘Y[HšYÙ[NˆØØÜËÑUTLÓÔ‘S—ÑTÖK›YJ‹ÙØÜËÑUTLÓÔ‘S—ÑTÖK›Y
K‚‚ŒKˆ˜XÚİ\H™\Ù\˜XÚpìÛˆHÙÜÂŒ‹ˆ\ŞHYÙH[˜İ[Ûˆ\ÜÚÙ^KX]]›Ü]YXYBŒËˆ”ÈYÜ™YØYÈ
İYÙLÚ\™[—ØØ][Ù×ÜØ[\×ÜœØ
BˆÚY\œ™H[›ÛˆØ[\ËÜØ[WÚ][\È
İYÙLØÛÜÙWØ[›Û—ÜØ[\Ø
BKˆ\ŞH\
È0î˜›XÛËRK”ÓÓ‹S
B‹ˆÜ˜[ÈØ]0è[ÙÛÈÛÛ[[‹[]™[
İYÙLÜX›X×ØØ][Ù×ØÛÛ[[—ÙÜ˜[Ø‘U“ÒÑH[›ÛŠÔP“PÊBËˆYX˜\È[YÜ˜XÚpìÛˆ[›Û‹ÜÜÚ]]˜\ËØÜ›ÜÜË]\Ù\ˆ
œH[ˆ\İš[YÜ˜][Û˜
BˆZYÜ˜XÚpìÛˆYØXŞH™XÙZ\È
ÈXÚÙ]š]˜YÈ\İšXİÈ
İYÙLÜ™XÙZ\×Üš]˜]WØXÚÙ]
B‚ˆÈÈÈLKŒˆ›ÜØ\™Yš^İYÙH
[™[\š[ÈYØXŞJB‚ŸZYÜ˜XÚpìÛˆ\İYÈXØÚpìÛˆŸKK_KK_KK_ŸİYÙLÜ™]›ÚÙWØ]][XØ]YÛYØXŞWÚ[™[ÜX
Š\XØYÈH™\šYšXØYÈ[ˆ›ÙXØÚpìÛŠŠˆ‘U“ÒÑHVPÕUHHİYÙLÚ[™[ÜWÛYØXŞWÜ™XÙZ\İ\›Ê
XH]][XØ]YÈVPÕUHÛÛÈÙ\šXÙWÜ›ÛX‚“›È™XXœš\ˆVPÕUHH]][XØ]Yˆ›È™XXœš\ˆ[›Û‹‚‚ˆÈÈL‹ˆÚXÚÛ\İÛØ˜[HYš[š][ÛˆÙˆÛ™B‚•[ˆ0ë][HğìÛÈYYHX\˜Ø\œÙH\›Z[˜YÈÚN‚‚‹HÈHY[™HğìÙYÛËÛZYÜ˜XÚpìÛˆHØİ[Y[XÚpìÛˆ™\œÚ[Û˜YÜË‚‹HÈH[˜Û^YHYX˜\ÈÜÚ]]˜\ÈH™YØ]]˜\È›ÜÜ˜Ú[Û˜[\È[šY\ÙÛË‚‹HÈH[\ÜË[š]\š[ÜÈHZ[\İ0è[ˆ™\™\Ë‚‹HÈH[YÜ˜XÚpìÛ‹ÑL‘H™[]˜[H\İ0èH™\™K‚‹HÈHÙH™\šYšXğìÈ[ˆİYÚ[™ÈÛÛˆ›Û\È™X[\Ë‚‹HÈHY[™H[ˆH\ÜYYİYHH™Xİ\\˜XÚpìÛ‹Ù›ÜØ\™Yš^‚‹HÈH›È™YÚ\İ˜HRHšHÙXÜ™]ÜË‚‹HÈHÜÈÜš]\š[ÜÈHXÙ\XÚpìÛˆY\›Ûˆ˜[YYÜÈÜˆPKÜ™]š\ÛÜ‹‚‹HÈHÙH\ÜYğìÈH\ğìÈÛ[ÚÙH\İÜÙ\ŞK‚‹HÈHUQUÔ’PK›YH\İH[ˆÙHXİX[^˜\›ÛˆÚHØ[XšpìÈ[šY\ÙÛÈ™\ÚYX[‚‚ˆÈÈLËˆpê]šXØ\ÈHÚY\œ™B‚Ÿpê]šXØHØš™]]›ÈŸKK_KKNŸŸš[\ÈÙ[œÚX›\ÈXØÙ\ÚX›\ÈÜˆ[›Û˜ŸÛÛ[[˜\È[\›˜\ÈXØÙ\ÚX›\È\ÙHØ]0è[ÙÛÈŸ™YÚ\İ›È\ÜÚÙ^HÚ[ˆÙ\ÚpìÛˆXÙ\YÈŸY™\™[˜ÚXHRHÈ˜\ÙHÈÛÛ\›Ø˜[H	ŸZYÜ˜XÚ[Û™\È™\›ÙXÚX›\È\ÙHÙ\›ÈL	HŸL‘HÜ°ë]XÛÜÈZ™Xİ]YÜÈ[ˆÒHL	HŸÜİËšœØ\Üpê\ÈH\ŞHŒŸ\œ›Ü™\È^Ú[ˆ˜^˜KØÛÜœ™[][ÛˆQŸ™\İ]\˜XÚ[Û™\È[œØ^XY\È[Y[›ÜÈHÜˆš[Y\İ™H‚ˆÈÈMˆ™YÚ\İ›ÈH]˜[˜ÙB‚Ÿ™XÚH]\HØ[Xš[È\İYÈ]šY[˜ÚXHÈˆŸKK_KK_KK_KK_KK_ŸŒ‹LLH[šYšXØXÚpìÛˆÜ™XXÚpìÛˆH]Y]Ü°ëXHH[ˆšYÙ[HÛÛ\]YÈUQUÔ’PK›YS‹›YŸŒ‹LLHÛÛ[˜ÚpìÛˆ[\[Y[XÚpìÛˆ[ˆ™\È
\ÜÚÙ^\ËÈØ]0è[ÙÛËZYÜ˜XÚ[Û™\Ë”ÓÓ‹S[˜›ÛÚÜÊH[ˆİ\œÛÈÚ[ˆ\ŞKÜ›Ùpî›ÈØ]HÈ[™Y[HŸŒ‹LLHÛÛ[˜ÚpìÛˆš^›Ü]YXYÜ™\Îˆ‘U“ÒÑHP“PË™XÙZ\È0ë[Z]\È^0ëXÚ]ÜËYØXŞHØİ[Y[YË\İÈ[YÜ˜XÚpìÛ‹Ü™[ˆ\ŞH[ˆİ\œÛÈ™\ˆØÜËÑUTLÓÔ‘S—ÑTÖK›YŸŒ‹LLLÛÛ[˜ÚpìÛˆ
Š\XØYÈH™\šYšXØYÈ[ˆ›ÙXØÚpìÛŠŠˆ
\ÜÚÙ^HQ‹ZYÜ˜XÚ[Û™\ÈİYÙL™\˜Ù[[\˜K˜ÛÛK˜\‹™XÙZ\Èš]˜]KˆYØXŞHZYÜ˜YÜÊH™\šYšXØYÈÛ[ÚÙH[›ÛˆH™[\ÎÈ\ÜÚÙ^HÎÈØ]0è[ÙÛÈŒÈ™XÙZ\ÈX›XÏY˜[ÙHŸŒ‹LLLÛÛ[˜ÚpìÛˆ›ÜØ\™Yš^[™[\š[ÈYØXŞNˆ‘U“ÒÑHVPÕUHH]][XØ]Y™\šYšXØYÈ\XØYÈ[ˆ›Ù

—ÜİYÙLÜ™]›ÚÙWØ]][XØ]YÛYØXŞWÚ[™[ÜKœÜ[
HŸŒ‹LLLÛÛ[˜ÚpìÛˆ]˜[XXÚpìÛˆHÙXÜ™]ÜÈ
ÑPËLÊHÛÛ\]YÈ›ÜY]\š[ÈÛÛ™š\›XH]YH[˜ØHØ[Y\›Ûˆ[\]Z\ÎÈ›İXÚpìÛˆ›È™\]Y\šYHŸŒ‹LLLHÙYİ\šYYH[YÜšYY›Û\È
È“È
ÈÔÈ™XÚ[ÜÈ
ÜÚpìÛˆJH
È\ÜÚÙ^\ÈŒˆ\Ùpì[È[ˆİ\œÛÈš[Y\˜H™\œÚpìÛˆ[ˆ™\ÎÈ
Š››È\ÜYØYÊŠˆŸŒ‹LLLHHÙYİ\šYYH[YÜšYYÛÜœ™XØÚpìÛˆ[YÜ˜[]\HH
œ›Û\˜HÔË›Ûİİ˜\“ËYÛÜË\İËØÜÊH[ˆ™]š\ÚpìÛˆØÜËÑUTLWÔ•S“ÓÒË›YÈ
Š››È\ÜYØYÊŠÈ[™Y[H™]šY]È[X[˜HŸŒ‹LLLHHÙYİ\šYYH[YÜšYY™KX]Y]Ü°ëXNˆ\Ù\—Ü›Û\ÈÛXÚY\ÈÜİLŒML‹Ú[ˆSUH™[\ËØÚÈ\İØYZ[‹œ™XZÙİÛˆ\İšXİË\İÈÙXİY[˜ÚXH[ˆ™]š\ÚpìÛˆÛÛÈØØ[È
Š››È\ÜYØYÊŠˆŸŒ‹LLLHHÙYİ\šYYH[YÜšYYÛÜœ™XØÚpìÛˆÜİ\™]šY]ÎˆØ]0è[ÙÛÈ[›Ûˆ™\Ù\˜YË[]HÛÛ˜İ\œ™[HÙ\šX[^˜YËœ™XZÙİÛˆ™\Ù[HÛÛÈZ^Ëš^\™\ÈH›Û\È™\İ]\˜X›\È[ˆ™]š\ÚpìÛˆÛÛÈØØ[È
Š››È\ÜYØYÊŠˆŸŒ‹LLLˆ8 $ÌHÚY\œ™Hİ\X˜\ÙH
È™\˜Ù[\ÜYØYÜÎÈÜÈYZ[œÎÈÛ[ÚÙHÙÚ[‹İ™[KÜİØÚËÜ™XÙZ\È›Ø™\È[›ÛˆH\ÜÚÙ^H™\™\ÎÈ\ÜÚÙ^\È\ØØ\Y\ÈÛÛ\]YÈÛÛ[Z]ÈÎXXMÌXXÈ™\šYšXØXÚpìÛˆ›ÙXİ]˜HŒ‹LLLˆŸŒ‹LLLˆˆÛØšY\››ÈH]ÜÈ˜\Ù[[™HÜ™Y[™šY[›ÜØ\™[Û›HİYÙH‹\ÜËÒH‹\ÙXİ\š]K[™[\š[ÈH[˜›ÛÚÈÛÛ\]YÈÛÛ[Z]ØÌÈÒH™\™NÈZYÜ˜XÚpìÛˆŒŒLŒLÎLLØHÛ[ÚÙH›ÙXİ]›ÈÒÈ‚‘\İYÜÈ\›Z]YÜÎˆ[™Y[X[ˆİ\œÛØ›Ü]YXYØ[ˆ™]š\ÚpìÛ˜˜\ÜYØYØ™\šYšXØYØHÛÛ\]YØ‚