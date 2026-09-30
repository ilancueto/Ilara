# Revisión de permisos de RPC

Proyecto revisado: producción Ilara `qbbnvdmadgomfmrsfxlo`. No se modificaron datos de clientes, pedidos ni stock en esta revisión. La migración `20260930023621_harden_mp_backend_rpc_permissions.sql` se validó en PostgreSQL aislado y se aplicó en producción.

## Correcciones

- `attach_mp_preference(jsonb)` queda exclusivamente para `service_role`. Antes un comprador con acceso a su pedido podía adjuntar una URL HTTPS elegida por él mediante PostgREST. Ahora sólo la Edge Function `payments-mp-preference`, que recibe la respuesta de Mercado Pago, puede adjuntarla.
- `mp_preference_context(text)` queda exclusivamente para `service_role`: los datos de contacto que necesita el proveedor no tienen que estar expuestos mediante una RPC del navegador. La función desplegada usa el cliente administrativo para ambas operaciones; su flujo conserva el acceso por capability o token de seguimiento.
- `is_app_admin`, `can_manage_inventory`, `can_manage_finance` y `can_use_pos` pasan a `SECURITY INVOKER`. Sólo llaman a `current_app_role`, que mantiene el lookup privilegiado limitado a `auth.uid()` y evita recursión de RLS.

## Avisos de privilegios necesarios

El advisor informa que las siguientes seis RPC públicas son `SECURITY DEFINER`; esto exige mantener sus controles y grants, pero no implica acceso público directo a tablas privadas:

| RPC | Alcance y control |
|---|---|
| `catalog_sales_by_product` | Agregados de unidades vendidas por producto, usados por el orden público de más vendidos; no expone filas de ventas. |
| `payment_public_pricing_context` | Flags y parámetros de precio visibles en el catálogo; no expone la cuenta bancaria ni contactos de clientes. |
| `create_catalog_order` | Pedido anónimo con validación de líneas, precios de servidor, límites e idempotencia en los wrappers/core privados. |
| `start_catalog_order_payment` | Resuelve capability o token de seguimiento válido y vigente, sin aceptar un `order_id` elegido por el cliente; recalcula el precio y serializa la operación. |
| `get_catalog_payment_public` | Resuelve capability válida, no revocada y no vencida antes de consultar el pedido. |
| `get_catalog_order_follow` | Verifica conjuntamente número de pedido y token/sesión de seguimiento, vigencia y revocación. |

Los 40 avisos de ejecución por `authenticated` incluyen estas seis RPC y las operaciones administrativas/POS. Se revisaron los cuerpos desplegados: las operaciones administrativas comprueban `auth.uid()` y rol de aplicación; POS comprueba `can_use_pos`; el wrapper de devoluciones delega a `private.create_order_return`, que exige administrador. `set_user_role` verifica el rol del llamador, protege al último administrador y sólo admite el bypass de backend para el claim firmado `service_role`. Los helpers no usan `user_metadata` como autoridad.

No se revocan estas RPC necesarias para eliminar un aviso genérico. No se silencian avisos nuevos ni se declara aprobada toda la suite cloud. Las 28 tablas con RLS sin políticas sirven a operaciones de backend/funciones privilegiadas: no requieren una política pública permisiva.

## Evidencia

- SQL aislado: 56 migraciones completas y 51 tablas con RLS; los nuevos grants impiden ambas RPC internas para `anon` y `authenticated`; continúan aprobados los ciclos de precios, stock, pedidos, idempotencia, cancelación y combos.
- Producción: grants consultados después de aplicar la migración confirman denegación de las dos RPC para `anon` y `authenticated`, permiso para `service_role` y cuatro predicados sin `SECURITY DEFINER`.
- Producción: transacción `READ ONLY` con identidad de prueba sin rol de aplicación. Los cuatro predicados devuelven `false` y 13 RPC administrativas de lectura rechazan con `42501`. La transacción finaliza con `ROLLBACK`; no se creó un usuario de Auth.
- La revisión previa de 45 requests HEAD anónimos rechazó las tablas sensibles y columnas internas de productos.

## Limitación del proveedor

El advisor sigue informando `auth_leaked_password_protection`. La organización está en Free y [Supabase ofrece la protección contra contraseñas filtradas en Pro o superior](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Se intentó guardar el ajuste desde el panel autorizado, pero no quedó aplicado; se canceló la edición pendiente. No se contrató una suscripción y no se presenta este aviso como corregido. La protección en un formulario de la aplicación no sustituye una restricción de Supabase Auth, porque su API sigue siendo accesible directamente.

Referencias del advisor: [RPC públicas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RPC autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
