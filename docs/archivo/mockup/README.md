# ✨ Ilara Beauty — Overhaul Estético & Mockups Interactivos

Este directorio `mockup/` contiene el **prototipo interactivo de alta fidelidad** con el rediseño estético total de Ilara Beauty, tanto para la gestión interna (**Panel de Control Unificado**) como para la experiencia pública de las clientas (**Catálogo Digital Luxury**).

---

## 🌟 Estructura del Mockup

```
mockup/
├── index.html          # 🌟 Master Showcase Hub (Visor con selector de vistas y simulador de dispositivos)
├── panel.html          # ⚙️ Panel de Control Unificado (All-in-One POS, Pedidos, Stock, Finanzas, CRM)
├── catalogo.html       # 🛍️ Catálogo Digital Luxury (Tienda Online + Carrito + WhatsApp Checkout)
├── styles/
│   ├── design-tokens.css   # Variables de color (Light Cashmere & Dark Obsidian), tipografías y sombras
│   ├── components.css      # Botones, badges animados, inputs con shortcuts, modales y toasts
│   ├── panel.css           # Estilos del panel de control unificado y POS dual-pane
│   └── catalogo.css        # Estilos de la tienda editorial y drawer de compras
├── scripts/
│   ├── mock-data.js        # Base de datos simulada de cosmética (productos, tonos, ventas, órdenes)
│   ├── app.js              # Controlador de temas (Dark/Light) y utilidades globales
│   ├── panel.js            # Lógica reactiva del POS, cobro multimetodo y pipeline Kanban
│   └── catalogo.js         # Lógica del catálogo (carrito, cálculo de envío gratis, cupones, WhatsApp)
└── README.md           # Esta guía
```

---

## 🚀 Cómo Visualizar y Probar

1. **Abrir directamente en cualquier navegador:**
   - Puedes hacer doble clic o abrir con tu navegador el archivo `mockup/index.html`.
   - También puedes abrir de forma directa e independiente `mockup/panel.html` o `mockup/catalogo.html`.

2. **Funciones Interactivas del Showcase (`index.html`):**
   - **Selector de Vista**: Cambia instantáneamente entre el **Panel Unificado** y el **Catálogo Luxury**.
   - **Simulador de Dispositivos**: Visualiza cómo responde el diseño en **Desktop**, **iPad Pro** y **iPhone 15 Pro**.
   - **Selector de Tema**: Alterna entre el tema **Claro (Warm Cashmere & Rose Gold)** y el tema **Oscuro (Obsidian Velvet)**.

---

## 💎 Aspectos Clave del Rediseño

### 1. Panel de Control Unificado (`panel.html`) — *"Todo en un simple panel"*
- **Header de Estado en Tiempo Real**: Visualización permanente de caja abierta, ticket promedio, margen neto en tiempo real y alertas de stock crítico.
- **Punto de Venta (POS) Dual-Pane**:
  - Catálogo táctil con selector de tonos con muestras reales de color.
  - Ticket en vivo con cálculo automático de vuelto en efectivo y soporte multimetodo (QR, transferencia, tarjeta).
  - Emisión de ticket digital con envío directo a WhatsApp.
- **Pipeline de Pedidos WhatsApp**:
  - Tablero Kanban interactivo con botones de 1-clic para avisar a la clienta por WhatsApp en cada cambio de estado.
- **Finanzas & Margen Real**:
  - Cálculo en vivo de ganancia neta en mano: `Ventas Brutas - Costo de Mercadería (CMV) - Gastos Operativos`.
  - Registro express de gastos.
- **Clientes & Club VIP (CRM)**:
  - Ficha 360° con LTV, puntos acumulados y tono preferido de base de maquillaje.

---

### 2. Catálogo Digital Luxury (`catalogo.html`)
- **Estética Editorial**: Tipografía de revista de lujo (`Cormorant Garamond` + `Plus Jakarta Sans`) y fotografía de alta resolución.
- **Swatches de Tono**: Selección interactiva del tono deseado (labial/base) directamente desde la tarjeta del producto.
- **Barra de Progreso de Envío Gratis**: Cálculo dinámico en el carrito (*"¡Agregá $8.500 más para envío GRATIS!"*).
- **Motor de Cupones**: Validación instantánea de códigos promocionales (`GLOW10`, `ILARA20`, `BEAUTYVIP`).
- **Checkout WhatsApp Automatizado**: Genera un mensaje preformateado con todos los detalles del pedido, método de entrega y total a pagar.
