# MasterContext - Mapeo Genético del Arkivo y Protocolo Soberano (Bunker)

Este documento detalla la arquitectura técnica actual de "Oldie but Goldie", evolucionada desde un marketplace asíncrono hacia un sistema de **Soberanía de Datos (Bunker Protocol)** con inventario físico real y automatización SEO.

---

## 1. Arquitectura A.N.T. (Asset, Network, Transaction)

El sistema opera bajo tres capas de abstracción para garantizar la integridad y la velocidad:

1.  **A (Asset - Bunker)**: El núcleo soberano. Colección `inventory` en Firestore. Contiene los discos físicos en stock ("The Bunker").
2.  **N (Network - Discogs)**: La red externa. Se usa como fuente de metadatos y validación de precios de mercado.
3.  **T (Transaction - Orders/Lotes)**: La capa de intercambio. Gestiona las negociaciones, el carrito ("Lote") y el flujo de WhatsApp.

---

## 2. Esquema de Colección `inventory` (The Bunker)

A diferencia del inicio del proyecto, ahora existe un inventario duro. Los ítems aquí tienen persistencia propia.

### Campos de un InventoryItem:
```json
{
  "id": "UUID_LOCAL",
  "metadata": {
    "title": "Álbum",
    "artist": "Artista",
    "isBatch": boolean // Define si es un lote de varios discos
  },
  "media": {
    "thumbnail": "URL",
    "full_res_image_url": "URL (Firebase Storage)"
  },
  "logistics": {
    "stock": 5, // Gestión real de unidades
    "price": 15000,
    "status": "active" | "sold_out" | "archived"
  },
  "items": [] // Si isBatch=true, contiene el detalle de cada disco del lote
}
```

---

## 3. Flujo Transaccional y "El Lote" (Carrito)

El carrito de compras (`LoteContext.tsx`) es agnóstico a la fuente. Normaliza datos de:
1.  **Discogs**: Metadatos en tiempo real.
2.  **Bunker**: Assets locales con stock garantizado.
3.  **Legacy Orders**: Órdenes antiguas que se quieren re-comprar.

### Normalización de Datos:
La función `addItemFromInventory` en `LoteContext` actúa como un adaptador que mapea cualquier estructura (Pedido, Ítem de Inventario o Release de Discogs) a un `BatchItem` estándar para el checkout.

---

## 4. Gestión de Batches (Lotes de Discos)

Los lotes son ciudadanos de primera clase.
-   **En Base de Datos**: Un lote en la colección `inventory` tiene `metadata.isBatch = true` y un array `items` con los detalles de cada disco.
-   **En UI (`AlbumDetail.tsx`)**: Si un ítem es un lote, se oculta el tracklist estándar y se despliega el "Contenido del Lote" (grilla de unidades).

---

## 5. SEO y Automatización (Sitemap + Robots)

El sistema genera automáticamente el `sitemap.xml` a través de una función serverless (`/api/sitemap`).
-   **URL dinámicas**: Incluye automáticamente todos los items activos del Bunker (`/album/ID`).
-   **Cache**: Posee una técnica de cache agresivo (S-MaxAge: 24h) para estabilidad en los motores de búsqueda.
-   **Robots.txt**: Prioriza la indexación del sitemap y el acceso de bots a las rutas de álbumes soberanos.

---

## 6. Identidad y Administración

-   **Admin Centralizado**: Se mantiene la validación por email (`admin@discography.ai`) y el flag `admin_session` en localStorage.
-   **Premium Showcase**: Componente en `Home.tsx` que prioriza visualmente los Items del Bunker (Soberanos) y las ofertas destacadas del administrador.

---

## 7. Conclusión sobre el Stock

A diferencia de las versiones iniciales, el stock es **deductivo** y **soberano**. Un "Bunker Import" clona los datos de Discogs hacia nuestra infraestructura para que el negocio no dependa de la disponibilidad de la API externa para mostrar el catálogo físico.
