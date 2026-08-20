/**
 * ILARA BEAUTY - MOCK DATABASE & SEED DATA
 * Curated data representing real beauty products, POS transactions, orders, and financial ledgers.
 */

const MOCK_DATA = {
  storeInfo: {
    name: 'Ilara Beauty Studio',
    tagline: 'Cosmética & Skincare de Alta Gama',
    address: 'Av. Libertador 2450, Piso 3, Buenos Aires',
    phone: '+54 9 11 5849-2310',
    whatsapp: '5491158492310',
    instagram: '@ilara.beauty',
    currency: 'ARS',
    cashRegister: {
      id: 'REG-042',
      status: 'open',
      openedAt: '2026-08-17 09:00',
      initialCash: 50000,
      currentBalance: 482350,
      todaySalesCount: 14,
      todayGrossRevenue: 184200,
      todayNetMarginPct: 54.2
    }
  },

  categories: [
    { id: 'all', name: 'Todos los Productos', icon: '✨' },
    { id: 'skincare', name: 'Skincare Facial', icon: '🌸' },
    { id: 'makeup', name: 'Maquillaje & Rostro', icon: '💄' },
    { id: 'lips', name: 'Labios & Tintas', icon: '💋' },
    { id: 'combos', name: 'Combos & Rutinas', icon: '🎁' },
    { id: 'haircare', name: 'Cuidado Capilar', icon: '✨' },
    { id: 'perfumes', name: 'Fragancias & Brumas', icon: '🌿' }
  ],

  products: [
    {
      id: 1,
      sku: 'ILA-SKN-001',
      name: 'Sérum Iluminador Glow Vitamina C 15%',
      brand: 'Ilara Lab',
      category: 'skincare',
      categoryName: 'Skincare Facial',
      purchasePrice: 6500,
      salePrice: 18900,
      stock: 24,
      minStock: 8,
      skinType: ['Todas', 'Mixta', 'Opaca'],
      badge: 'MÁS VENDIDO',
      rating: 4.9,
      reviewsCount: 128,
      description: 'Potente concentrado antioxidante con Vitamina C pura al 15%, Ácido Ferúlico y Hialurónico. Aporta luminosidad inmediata y unifica el tono de la piel.',
      benefits: ['Luminosidad instantánea', 'Reduce manchas solares', 'Efecto antioxidante 24h'],
      usage: 'Aplicar 4 gotas por la mañana sobre rostro y cuello limpios antes de la hidratante.',
      image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1608248597359-0091d3ec17ba?auto=format&fit=crop&w=800&q=80'
      ],
      shades: []
    },
    {
      id: 2,
      sku: 'ILA-MAK-002',
      name: 'Base Líquida Silk Velvet Foundation SPF 25',
      brand: 'Ilara Couture',
      category: 'makeup',
      categoryName: 'Maquillaje & Rostro',
      purchasePrice: 9200,
      salePrice: 24500,
      stock: 18,
      minStock: 6,
      skinType: ['Normal', 'Seca', 'Mixta'],
      badge: 'NUEVO TONO',
      rating: 4.8,
      reviewsCount: 94,
      description: 'Base ultra ligera con cobertura media modulable y acabado satinado segunda piel. Infusionada con escualano vegetal para 16hs de confort.',
      benefits: ['Acabado natural glow', 'No transfiere', 'Protección solar SPF 25'],
      usage: 'Agitar antes de usar. Difuminar con brocha densa o esponja húmeda desde el centro del rostro.',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80'
      ],
      shades: [
        { name: '01 Porcelaine Warm', hex: '#F6E5D7', stock: 5 },
        { name: '02 Nude Cashmere', hex: '#EACFBE', stock: 6 },
        { name: '03 Warm Honey', hex: '#DCBAA1', stock: 4 },
        { name: '04 Golden Almond', hex: '#B88B67', stock: 3 }
      ]
    },
    {
      id: 3,
      sku: 'ILA-LIP-003',
      name: 'Bálsamo Labial con Péptidos & Color Lip Glaze',
      brand: 'Ilara Beauty',
      category: 'lips',
      categoryName: 'Labios & Tintas',
      purchasePrice: 3800,
      salePrice: 11200,
      stock: 4,
      minStock: 10,
      skinType: ['Todas'],
      badge: 'STOCK CRÍTICO',
      rating: 5.0,
      reviewsCount: 215,
      description: 'Tratamiento labial de alta densidad con tripéptidos reparadores y manteca de karité. Rellena líneas de expresión y brinda un brillo tipo espejo sin sensación pegajosa.',
      benefits: ['Efecto volumen natural', 'Hidratación intensiva 12h', 'Aroma sutil a vainilla francesa'],
      usage: 'Aplicar directamente en los labios tantas veces al día como sea necesario o sobre tu labial mate.',
      image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80'
      ],
      shades: [
        { name: 'Rosé Mist', hex: '#D6899A', stock: 2 },
        { name: 'Caramel Glaze', hex: '#BD7D67', stock: 1 },
        { name: 'Berry Noir', hex: '#893B4E', stock: 1 }
      ]
    },
    {
      id: 4,
      sku: 'ILA-SKN-004',
      name: 'Crema Hidratante Barrier Repair Ceramide Cloud',
      brand: 'Ilara Lab',
      category: 'skincare',
      categoryName: 'Skincare Facial',
      purchasePrice: 7800,
      salePrice: 22400,
      stock: 15,
      minStock: 5,
      skinType: ['Seca', 'Sensible', 'Dañada'],
      badge: 'FAVORITO DERMA',
      rating: 4.9,
      reviewsCount: 88,
      description: 'Crema sedosa con complejo de 5 ceramidas esenciales, centella asiática y avena coloidal. Restaura la barrera cutánea debilitada por ácidos o frío.',
      benefits: ['Calma rojeces e irritaciones', 'Textura nube ultraligera', 'Hipoalergénica sin fragancia'],
      usage: 'Masajear suavemente día y noche luego del sérum.',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80'
      ],
      shades: []
    },
    {
      id: 5,
      sku: 'ILA-CMB-005',
      name: 'Set Rutina Glow Radiance Completa (3 Pasos)',
      brand: 'Ilara Rituals',
      category: 'combos',
      categoryName: 'Combos & Rutinas',
      purchasePrice: 15200,
      salePrice: 42900,
      originalPrice: 52500,
      stock: 9,
      minStock: 4,
      skinType: ['Todas las pieles'],
      badge: 'AHORRÁ 18%',
      rating: 5.0,
      reviewsCount: 67,
      description: 'El ritual definitivo para piel luminosa: incluye Limpiador Gel Suave (150ml) + Sérum Vitamina C 15% (30ml) + Crema Barrier Repair (50ml) en estuche de terciopelo rosa.',
      benefits: ['Ahorro garantizado de $9.600', 'Neceser velvet de regalo', 'Rutina completa día y noche'],
      usage: 'Paso 1: Limpiar. Paso 2: Sérum. Paso 3: Hidratar.',
      image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80'
      ],
      shades: []
    },
    {
      id: 6,
      sku: 'ILA-HAI-006',
      name: 'Óleo Reparador Capilar Golden Elixir Argan & Camellia',
      brand: 'Ilara Botanics',
      category: 'haircare',
      categoryName: 'Cuidado Capilar',
      purchasePrice: 5900,
      salePrice: 17500,
      stock: 2,
      minStock: 8,
      skinType: ['Cabello seco o dañado'],
      badge: 'STOCK BAJO',
      rating: 4.7,
      reviewsCount: 52,
      description: 'Tratamiento sellador de puntas con infusión de oro 24k coloidal, aceite de argán marroquí puro y camelia japonesa. Termoprotección hasta 230°C.',
      benefits: ['Control antifrizz 72hs', 'Brillo cristalino sin peso', 'Protección térmica'],
      usage: 'Aplicar 2 a 3 gotas en largos y puntas húmedas o secas.',
      image: 'https://images.unsplash.com/photo-1608248597359-0091d3ec17ba?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1608248597359-0091d3ec17ba?auto=format&fit=crop&w=800&q=80'
      ],
      shades: []
    },
    {
      id: 7,
      sku: 'ILA-MAK-007',
      name: 'Rubor Líquido Soft Flush Dewy Blush',
      brand: 'Ilara Couture',
      category: 'makeup',
      categoryName: 'Maquillaje & Rostro',
      purchasePrice: 4200,
      salePrice: 13900,
      stock: 22,
      minStock: 6,
      skinType: ['Todas'],
      badge: 'TRENDING',
      rating: 4.9,
      reviewsCount: 141,
      description: 'Rubor líquido infusionado con extracto de loto y ácido hialurónico. Se funde como una acuarela dejando mejillas frescas y saludables.',
      benefits: ['Pigmentación modulable', 'Larga duración 14h', 'Fácil de difuminar con dedos'],
      usage: 'Colocar 1 o 2 puntitos en los pómulos y difuminar rápidamente hacia arriba.',
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80'
      ],
      shades: [
        { name: 'Peach Aura', hex: '#F6A28E', stock: 8 },
        { name: 'Petal Dream', hex: '#E87D94', stock: 7 },
        { name: 'Cherry Flush', hex: '#BA3B57', stock: 7 }
      ]
    },
    {
      id: 8,
      sku: 'ILA-PRF-008',
      name: 'Bruma Aromática Silk Peony & Velvet Vanilla',
      brand: 'Ilara Maison',
      category: 'perfumes',
      categoryName: 'Fragancias & Brumas',
      purchasePrice: 6800,
      salePrice: 19800,
      stock: 14,
      minStock: 5,
      skinType: ['Cuerpo y Cabello'],
      badge: 'EDICIÓN ESPECIAL',
      rating: 4.8,
      reviewsCount: 39,
      description: 'Bruma corporal y capilar perfumada con notas de peonía francesa, vainilla de Madagascar y sándalo blanco. Fórmula sin alcohol agresivo enriquecida con pantenol.',
      benefits: ['Fragancia sutil y elegante', 'Hidrata piel y pelo', 'Ideal para llevar en la cartera'],
      usage: 'Vaporizar a 20 cm de distancia sobre el cuerpo, cabello y ropa en cualquier momento del día.',
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80',
      images: [
        'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80'
      ],
      shades: []
    }
  ],

  customers: [
    {
      id: 101,
      name: 'Camila Rodriguez',
      phone: '+54 9 11 4455-8899',
      email: 'camila.rodriguez@gmail.com',
      tier: 'VIP Gold',
      points: 850,
      ltv: 214500,
      purchasesCount: 9,
      favoriteCategory: 'Skincare Facial',
      preferredFoundationShade: '02 Nude Cashmere',
      lastPurchase: '2026-08-14'
    },
    {
      id: 102,
      name: 'Valentina Rossi',
      phone: '+54 9 11 6722-1144',
      email: 'valen.rossi@outlook.com',
      tier: 'Silver',
      points: 320,
      ltv: 78900,
      purchasesCount: 3,
      favoriteCategory: 'Maquillaje & Rostro',
      preferredFoundationShade: '01 Porcelaine Warm',
      lastPurchase: '2026-08-16'
    },
    {
      id: 103,
      name: 'Lucia Fernandez',
      phone: '+54 9 11 3311-7788',
      email: 'lucia.fer@gmail.com',
      tier: 'VIP Platinum',
      points: 1420,
      ltv: 389000,
      purchasesCount: 16,
      favoriteCategory: 'Combos & Rutinas',
      preferredFoundationShade: '03 Warm Honey',
      lastPurchase: '2026-08-17'
    },
    {
      id: 104,
      name: 'Sofia Gomez',
      phone: '+54 9 11 9988-2233',
      email: 'sofi.gomez@gmail.com',
      tier: 'Nuevo',
      points: 50,
      ltv: 18900,
      purchasesCount: 1,
      favoriteCategory: 'Labios & Tintas',
      preferredFoundationShade: null,
      lastPurchase: '2026-08-17'
    }
  ],

  ordersPipeline: [
    {
      id: 'PED-1048',
      customer: 'Camila Rodriguez',
      phone: '5491144558899',
      date: '2026-08-17 17:40',
      status: 'pending_payment',
      statusLabel: 'Pendiente de Pago',
      channel: 'Catálogo Web',
      deliveryMethod: 'Envío a Domicilio (Palermo)',
      total: 37800,
      items: [
        { name: 'Sérum Vitamina C 15%', qty: 1, price: 18900 },
        { name: 'Bálsamo Labial Péptidos (Rosé Mist)', qty: 1, price: 11200 },
        { name: 'Costo de Envío CABA', qty: 1, price: 7700 }
      ],
      whatsappTemplate: 'Hola Camila! ✨ Recibimos tu pedido #PED-1048 en Ilara Beauty. Tu total es de $37.800. Para coordinar el envío, podés transferir al alias ilara.beauty.mp y enviarnos el comprobante. ¡Muchas gracias!'
    },
    {
      id: 'PED-1049',
      customer: 'Lucia Fernandez',
      phone: '5491133117788',
      date: '2026-08-17 18:15',
      status: 'packing',
      statusLabel: 'En Preparación',
      channel: 'Catálogo Web',
      deliveryMethod: 'Retiro en Showroom',
      total: 42900,
      items: [
        { name: 'Set Rutina Glow Radiance Completa', qty: 1, price: 42900 }
      ],
      whatsappTemplate: 'Hola Lucia! ✨ Tu pedido #PED-1049 ya está siendo preparado en nuestro estuche velvet de regalo. Te avisaremos apenas esté listo para retirar por el Showroom!'
    },
    {
      id: 'PED-1050',
      customer: 'Mariana Soria',
      phone: '5491122334455',
      date: '2026-08-17 19:10',
      status: 'ready',
      statusLabel: 'Listo para Despacho / Retiro',
      channel: 'WhatsApp Directo',
      deliveryMethod: 'Envío Andreani Express',
      total: 38400,
      items: [
        { name: 'Base Silk Velvet Foundation (02 Nude)', qty: 1, price: 24500 },
        { name: 'Rubor Líquido Soft Flush (Petal Dream)', qty: 1, price: 13900 }
      ],
      whatsappTemplate: 'Hola Mariana! 🌸 Tu paquete #PED-1050 ya está empaquetado y listo para ser despachado. Tu código de seguimiento Andreani es IL89234902AR. ¡Que lo disfrutes!'
    }
  ],

  recentSales: [
    {
      id: 'VTA-3091',
      time: '19:42',
      customer: 'Sofia Gomez',
      itemsCount: 1,
      total: 18900,
      marginNet: 12400,
      paymentMethod: 'MercadoPago QR',
      items: 'Sérum Vitamina C 15%'
    },
    {
      id: 'VTA-3090',
      time: '18:55',
      customer: 'Cliente Mostrador (Anónimo)',
      itemsCount: 2,
      total: 35700,
      marginNet: 22300,
      paymentMethod: 'Efectivo (-10% Desc.)',
      items: 'Base Silk Velvet + Bálsamo Péptidos'
    },
    {
      id: 'VTA-3089',
      time: '17:20',
      customer: 'Valentina Rossi',
      itemsCount: 3,
      total: 54900,
      marginNet: 31200,
      paymentMethod: 'Transferencia',
      items: 'Crema Barrier + Rubor + Bruma Peony'
    }
  ],

  expensesLedger: [
    {
      id: 'EXP-101',
      date: '2026-08-17',
      category: 'envios',
      categoryLabel: 'Envíos y Logística',
      description: 'Cadetería express pedidos CABA (3 entregas)',
      amount: 14500,
      paymentMethod: 'Transferencia'
    },
    {
      id: 'EXP-102',
      date: '2026-08-17',
      category: 'marketing',
      categoryLabel: 'Marketing & Pauta Meta',
      description: 'Campaña Instagram Reels Colección Primavera',
      amount: 25000,
      paymentMethod: 'Tarjeta Crédito'
    },
    {
      id: 'EXP-103',
      date: '2026-08-16',
      category: 'inventario',
      categoryLabel: 'Compra de Insumos & Packaging',
      description: '50 Cajas rígidas velvet Ilara + Papel seda oro',
      amount: 38000,
      paymentMethod: 'Transferencia'
    }
  ],

  coupons: [
    { code: 'GLOW10', discountPercent: 10, minPurchase: 20000, description: '10% OFF en toda la tienda' },
    { code: 'ILARA20', discountPercent: 20, minPurchase: 50000, description: '20% OFF en compras mayores a $50k' },
    { code: 'BEAUTYVIP', discountPercent: 15, minPurchase: 0, description: '15% OFF exclusivo VIP' }
  ]
};

// Utilities for formatting
function formatARS(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
}
