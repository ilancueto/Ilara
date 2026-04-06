-- Script de diagnóstico: detecta triggers que podrían causar doble descuento de stock.
--
-- Ejecutar en Supabase → SQL Editor si se sospecha que el inventario resta por dos al vender.
--
-- Un trigger AFTER INSERT en stock_movements o sale_items que aplique UPDATE a products
-- causaría que create_sale_with_items descuente stock dos veces (una vez en el UPDATE
-- explícito de la RPC, y otra vez por el trigger).

-- 1. Listar TODOS los triggers del schema public
SELECT
  trigger_name,
  event_object_table  AS tabla,
  event_manipulation  AS evento,
  action_timing       AS momento,
  action_statement    AS cuerpo
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_schema       = 'public'
ORDER BY event_object_table, trigger_name;

-- 2. Verificar específicamente en stock_movements y sale_items
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('stock_movements', 'sale_items')
ORDER BY event_object_table, trigger_name;

-- Si alguna fila aparece en la consulta 2, ese trigger es el culpable del doble descuento.
-- La migración 20260406120000_drop_stock_double_deduct_triggers.sql los elimina automáticamente.
