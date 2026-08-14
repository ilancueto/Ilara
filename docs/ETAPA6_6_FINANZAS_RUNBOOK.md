# Stage 6.6 — Cuentas por cobrar/pagar y conciliación

## Objetivo

Cerrar Stage 6 con saldos financieros trazables. La aplicación reemplaza el
cambio directo de `sales.status` por un libro mayor append-only que registra
quién cobró o pagó, cuándo, cuánto y mediante qué medio.

El panel admin **Ingresos → Cuentas y caja** incluye:

- cuentas por cobrar creadas automáticamente desde ventas a crédito;
- cobros parciales y totales;
- cuentas por pagar manuales, vencimiento opcional y pagos parciales;
- conciliación de entradas, salidas y neto por medio de pago y período;
- historial inmutable por cuenta y saldos pendientes;
- medio de pago en otros ingresos.

## Reglas contables y de integridad

- Una venta `credito/pending_payment` crea una única CxC mediante trigger.
- Saldo CxC = venta original − notas de crédito `credito_cancelado` − cobros.
- La venta pasa a `completed` sólo cuando el neto queda saldado.
- Un pago no puede ser cero, negativo ni superar el saldo.
- `idempotency_key` impide duplicar un movimiento al reintentar.
- Una CxP no es gasto hasta que se paga. Cada pago genera un gasto ligado al
  movimiento para que egresos y conciliación coincidan sin duplicarse.
- Una CxP sólo puede cancelarse si todavía no tiene pagos; la cancelación conserva
  la cuenta y su motivo.
- La conciliación suma ventas de contado, cobros CxC y otros ingresos; resta
  gastos y reembolsos de caja. Excluye la venta crediticia directa porque sus
  cobros ya están representados por movimientos.
- El backfill crea cuentas para créditos históricos. Si ya estaban completados,
  registra un cobro histórico con medio `otro` y fecha de venta porque no existe
  evidencia más precisa.

## Modelo y permisos

- `financial_accounts`: CxC/CxP, origen, importe y estado operativo.
- `financial_movements`: cobros/pagos append-only, auditados e idempotentes.
- `incomes.payment_method`: medio para conciliar otros ingresos.

Ambas tablas financieras tienen RLS habilitado, sin grants para `anon` ni
`authenticated`. `service_role` conserva acceso operativo. Los RPC son
`SECURITY DEFINER`, fijan `search_path = ''`, requieren sesión y validan
`is_app_admin()` internamente. Un admin tampoco accede directamente a las tablas;
la UI usa exclusivamente:

- `finance_stage66_snapshot(date,date)`;
- `finance_create_payable(text,text,numeric,date)`;
- `finance_record_settlement(uuid,numeric,text,timestamptz,text,uuid)`;
- `finance_cancel_payable(uuid,text)`.

## Migración y recuperación

Migración: `20260814033000_stage66_financial_ledger.sql`.

Es forward-only. Ante una incidencia:

1. ocultar temporalmente **Cuentas y caja**;
2. revocar `EXECUTE` a `authenticated` en los RPC afectados;
3. no borrar cuentas ni movimientos para revertir;
4. corregir saldos, permisos o conciliación mediante una nueva migración;
5. conservar el vínculo `financial_movements.expense_id`.

## Validación local

- tres reconstrucciones completas desde cero con Stage 6.6;
- integración Stage 6.6: 5/5 (roles, superficie cerrada, CxC automática,
  parcialidad, idempotencia, sobrepago, devolución, CxP, gasto y conciliación);
- unitarios globales: 132/132;
- RLS: 31/31 tablas;
- matriz anon/service y security advisors verdes;
- tipos generados sin drift;
- lint, TypeScript y build Next.js 16.3 verdes;
- Playwright financiero: 1/1, sin violaciones axe críticas.

## Cierre productivo

Stage cerrado el 2026-08-14:

- feature commit `30d1463` y fix de aislamiento de test `1c3cd67` publicados en
  `main`;
- CI GitHub `31767514128`: `lint-test-build`, `db-security` y `e2e` verdes;
- migración productiva `20260814033000` aplicada y confirmada en el historial
  remoto;
- Vercel deployment `dpl_7Sy4WqNFTdUR3vrcZv6ERxY3htwv`, estado `READY`, alias
  `https://ilara.com.ar`;
- smoke productivo GET-only: 16/16;
- probes productivos `anon` contra cuentas, movimientos y snapshot: denegados
  con `42501`;
- escaneo de logs posterior al smoke: sin errores registrados.

El linter remoto de Supabase informa advertencias generales por RPC
`SECURITY DEFINER` ejecutables por roles previstos y protección de contraseñas
filtradas desactivada. Los cuatro RPC Stage 6.6 exigen `auth.uid()` e
`is_app_admin()` internamente; localmente los advisors estrictos y la matriz de
roles quedaron verdes. La opción de Auth es deuda operativa global, no una
regresión de Stage 6.6.
