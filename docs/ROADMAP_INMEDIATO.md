# Roadmap inmediato – Ilara

Plan de ejecución corto y accionable para empezar **ya mismo** sin frenar el proyecto con una reescritura.

---

## Objetivo

Consolidar la base del proyecto antes de sumar nuevas features grandes.

**Prioridades de esta etapa:**
1. Seguridad y permisos.
2. Confiabilidad de ventas / stock / cupones.
3. Mejor mantenibilidad del catálogo y de la app principal.
4. Preparación para crecer con más usuarios o más volumen.

---

## Cómo usar este archivo

- Avanzar de arriba hacia abajo.
- No abrir nuevos frentes hasta cerrar al menos el bloque actual.
- Cada tarea debe terminar con evidencia: commit, test, captura o checklist marcado.
- Si una tarea depende de Supabase, dejar también el SQL o instrucciones exactas en `docs/`.

---

# Fase 1 — Seguridad y blindaje básico

## 1.1 Cerrar RLS pendiente en Supabase

**Objetivo:** dejar alineadas las políticas con lo que la app ya asume.

### Tareas
- [ ] Verificar si `combos` y `combo_items` ya tienen RLS activo en el proyecto real.
- [ ] Si no lo tienen, crear o guardar el SQL final en el repo.
- [ ] Aplicar políticas para lectura pública solo donde corresponda.
- [ ] Confirmar que escritura/edición quede restringida a usuarios autenticados.
- [ ] Documentar el estado final en `docs/SECURITY_PENTEST.md` o en un doc nuevo de Supabase.

### Entregable
- SQL listo para ejecutar o aplicado.
- Documentación actualizada con el estado final.

### Definición de listo
- Un usuario anónimo puede acceder solo a lo público.
- Un usuario autenticado puede operar donde corresponde.
- No quedan tablas del flujo principal sin política definida.

---

## 1.2 Ejecutar checklist de seguridad real

**Objetivo:** convertir el documento de pentest en validación concreta.

### Tareas
- [ ] Probar acceso sin sesión a `/`, `/gastos` y otras rutas privadas.
- [ ] Verificar que `/catalogo` siga funcionando sin login.
- [ ] Probar operaciones a Supabase con sesión y sin sesión.
- [ ] Validar que no se pueda escribir en tablas protegidas usando anon key sin auth.
- [ ] Revisar XSS en comprobantes y campos textuales sensibles.
- [ ] Confirmar que no haya mixed content ni configuraciones de dominio dudosas.

### Entregable
- Checklist completo con resultado `OK / pendiente / bloqueado`.

### Definición de listo
- Queda evidencia escrita de qué se probó y qué faltó.

---

## 1.3 Revisar dependencias de PWA y seguridad del build

**Objetivo:** bajar el riesgo técnico del pipeline.

### Tareas
- [ ] Revisar si hay dependencias heredadas o sobrantes de soluciones PWA anteriores.
- [ ] Correr auditoría de dependencias.
- [ ] Evaluar actualización de paquetes de PWA/build sin romper la app.
- [ ] Documentar si se mantiene la estrategia actual o si conviene migrar más adelante.

### Entregable
- Nota técnica corta con decisión tomada.

### Definición de listo
- Se entiende claramente qué riesgo queda y por qué.

---

# Fase 2 — Confiabilidad de negocio

## 2.1 Tests unitarios de ventas, stock y cupones

**Objetivo:** cubrir la lógica que puede romper caja o datos.

### Tareas
- [ ] Identificar funciones y servicios críticos de ventas.
- [ ] Agregar tests de cálculo de total, subtotal y descuentos.
- [ ] Agregar tests para cupones válidos, inválidos y límites.
- [ ] Agregar tests para actualización de stock y movimientos.
- [ ] Cubrir casos borde: stock cero, descuentos 0%, pagos múltiples, venta pendiente.

### Entregable
- Suite de tests enfocada en lógica crítica.

### Definición de listo
- Los flujos más sensibles quedan cubiertos por tests automáticos repetibles.

---

## 2.2 E2E mínimos de negocio

**Objetivo:** detectar regresiones visibles antes de tocar features grandes.

### Tareas
- [ ] Flujo: login exitoso.
- [ ] Flujo: acceso a catálogo público.
- [ ] Flujo: agregar producto al carrito.
- [ ] Flujo: generar pedido por WhatsApp.
- [ ] Flujo: registrar una venta simple si el entorno de prueba lo permite.

### Entregable
- 3 a 5 pruebas E2E estables.

### Definición de listo
- Un cambio grande en catálogo o auth rompe tests si afecta el flujo real.

---

## 2.3 Verificar exportación y respaldo

**Objetivo:** asegurarse de que el negocio pueda recuperar sus datos.

### Tareas
- [ ] Probar exportación CSV de productos.
- [ ] Probar exportación JSON de ventas.
- [ ] Confirmar filtros por período en gastos y ventas.
- [ ] Revisar que la documentación coincida con la UI real.

### Entregable
- Checklist de exportación validado.

### Definición de listo
- El usuario puede respaldar datos sin depender de soporte técnico.

---

# Fase 3 — Ordenar arquitectura sin reescribir

## 3.1 Refactor del catálogo en hooks y utilidades

**Objetivo:** bajar complejidad del componente más valioso del proyecto.

### Tareas
- [ ] Extraer carga de datos a un hook (`useCatalogData` o similar).
- [ ] Extraer filtros, ordenamiento y paginación a otro hook.
- [ ] Extraer lógica de cupones / resumen / mensaje de WhatsApp a utilidades o hooks específicos.
- [ ] Dejar el componente principal más enfocado en render y composición.

### Entregable
- `components/Catalogo.tsx` más chico y más fácil de leer.

### Definición de listo
- Se puede tocar una parte del catálogo sin miedo a romper las otras.

---

## 3.2 Separar mejor el arranque/auth de la home principal

**Objetivo:** simplificar `app/page.tsx`.

### Tareas
- [ ] Extraer la lógica de auth inicial a un hook o helper.
- [ ] Separar el shell/layout del contenido de cada tab.
- [ ] Evitar que el archivo siga creciendo con más responsabilidad.

### Entregable
- Home principal con menos lógica mezclada.

### Definición de listo
- La navegación principal se entiende rápido leyendo el archivo.

---

# Fase 4 — Operación real y escalabilidad

## 4.1 Roles básicos

**Objetivo:** preparar el sistema para más de una persona operándolo.

### Tareas
- [ ] Diseñar roles mínimos: admin / operador.
- [ ] Definir qué acciones debe poder hacer cada uno.
- [ ] Elegir dónde se guarda el rol (perfil, metadata o tabla dedicada).
- [ ] Aplicar restricciones primero en UI y luego en backend/políticas.

### Entregable
- Documento corto de permisos + primera implementación.

### Definición de listo
- Ya no todo usuario autenticado puede hacer todo.

---

## 4.2 Auditoría visible

**Objetivo:** aprovechar mejor `created_by` y `updated_by`.

### Tareas
- [ ] Mostrar quién creó o editó ventas, gastos y productos donde tenga sentido.
- [ ] Confirmar que esos campos siempre se llenen desde la app.
- [ ] Definir qué vistas necesitan trazabilidad primero.

### Entregable
- Trazabilidad visible en al menos 2 módulos clave.

### Definición de listo
- Hay menos ambigüedad al investigar cambios o errores.

---

# Fase 5 — Mejoras de producto con impacto

## 5.1 Potenciar el catálogo como canal de venta

**Objetivo:** aumentar utilidad comercial, no solo administrativa.

### Tareas
- [ ] Revisar cómo se muestran combos y destacados.
- [ ] Mejorar mensajes compartibles / WhatsApp.
- [ ] Evaluar “más vendidos”, “nuevos” y “en descuento” como herramientas de conversión.
- [ ] Pensar métricas simples: clics, agregados al carrito, productos consultados.

### Entregable
- Lista de mejoras de conversión con impacto esperado.

### Definición de listo
- El catálogo no solo muestra productos: ayuda a vender mejor.

---

## 5.2 Reportes útiles, no decorativos

**Objetivo:** agregar reporting que ayude a decidir.

### Tareas
- [ ] Definir 3 métricas esenciales para el negocio.
- [ ] Priorizar ventas por período, top productos y gastos por categoría.
- [ ] Dejar márgenes o análisis más complejos para una segunda etapa.

### Entregable
- Roadmap corto de reporting con orden realista.

### Definición de listo
- Cada reporte responde una pregunta operativa concreta.

---

# Plan sugerido de ejecución (30 días)

## Semana 1
- Cerrar RLS pendiente.
- Ejecutar checklist básico de seguridad.
- Revisar dependencias y riesgo de build.

## Semana 2
- Crear tests unitarios de ventas/cupones/stock.
- Validar exportaciones.

## Semana 3
- Crear E2E mínimos.
- Empezar refactor del catálogo.

## Semana 4
- Continuar refactor.
- Diseñar roles.
- Definir siguiente bloque de mejoras de producto.

---

# Qué NO hacer todavía

- [ ] Reescribir toda la app.
- [ ] Meter demasiadas features nuevas antes de cerrar seguridad y tests.
- [ ] Complejizar permisos sin una matriz simple de roles.
- [ ] Hacer dashboards enormes sin validar primero la calidad del dato.

---

# Primeras 3 tareas para arrancar hoy

Si querés empezar **ahora mismo**, haría estas tres primero:

1. **Verificar y cerrar RLS de `combos` y `combo_items`.**
2. **Armar tests unitarios para ventas, descuentos y stock.**
3. **Partir `components/Catalogo.tsx` en hooks/utilidades más chicos.**

---

# Estado

- Responsable: pendiente
- Fecha de inicio: pendiente
- Fecha objetivo: pendiente
- Estado general: en preparación

