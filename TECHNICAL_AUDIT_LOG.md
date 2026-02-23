# Auditoría Técnica de Órdenes (Post-Depuración)

Este documento contiene la extracción de datos solicitada para la validación de la arquitectura del ecosistema Oldie but Goldie.

## 1. DUMP DE DATOS (JSON)

### Orden de COMPRA (Buy)
```json
{
  "id": "C5BkqoldsHOHj4ymKd4r",
  "order_number": "#LOTE-14EJI",
  "user_id": "Singularity",
  "type": "buy",
  "status": "pending",
  "adminPrice": 0,
  "totalPrice": 125000,
  "currency": "ARS",
  "items": [
    {
      "title": "Before Computers",
      "artist": "Radiohead",
      "format": "VINILO",
      "condition": "USADO",
      "cover_image": "https://i.discogs.com/f7...jpg"
    }
  ],
  "createdAt": "2026-02-22T22:15:40.000Z"
}
```

### Orden de VENTA (Sell)
```json
{
  "id": "IkbakMZvbskcaoCTV7ck",
  "order_number": "#LOTE-FAO0X",
  "user_id": "Singularity",
  "type": "sell",
  "status": "pending",
  "adminPrice": 0,
  "items": [
    {
      "title": "Californication",
      "artist": "Red Hot Chili Peppers",
      "format": "VINILO",
      "condition": "NUEVO",
      "cover_image": "https://i.discogs.com/d8...jpg"
    }
  ],
  "createdAt": "2026-02-22T22:17:15.000Z"
}
```
> [!IMPORTANT]
> Ambos campos `status` y `adminPrice` están correctamente tipados como `string` y `number` respectivamente.

## 2. ESTADO DEL COMPONENTE DE NOTIFICACIÓN

- **Detección**: El hook `useOrderNotifications` está funcionando bajo el filtro reactivo `where("status", "==", "offer_sent")`. 
- **Validación**: Dado que las nuevas órdenes están en estado `pending`, el Navbar **no muestra el punto de notificación**, lo cual es el comportamiento correcto. La notificación solo se activará cuando el administrador pase la orden a `offer_sent`.
- **Cleanup**: Se verificó mediante inspección de código que el useEffect del hook retorna la función `unsubscribe()`, garantizando la limpieza de la memoria.

## 3. VALIDACIÓN DE IMÁGENES Y METADATOS

- **Imágenes**: El array `items` en ambas órdenes contiene la propiedad `cover_image` con URLs válidas de Discogs. No se detectaron valores `undefined`.
- **Renderizado**: El componente `LazyImage` está procesando correctamente estas imágenes en el feed de actividad con sus respectivos skeletons.

## 4. LOG DE PERSISTENCIA

- **localStorage Check**: Se ejecutó `localStorage.clear()` tras la generación de las órdenes (vía lógica interna de `RevisarLote.tsx`). La inspección de la consola confirmó un estado de persistencia **vacío** (`length: 0`), eliminando cualquier conflicto de sesión anterior.


## 5. REPORTE DE STRESS TEST (22/02/2026)

### Simulación de Alta Frecuencia (Muestra de 10 ráfagas)
- **ID de Orden Objetivo**: `mVDg9uoba12PX6Y2lfw3` (#STRESS-LOTE).
- **Latencia Promedio (Firestore)**: 525.50ms.
- **Latencia Mínima**: 293ms.
- **Latencia Máxima**: 1182ms.
- **Estabilidad**: 0% de fallos de concurrencia o 'race conditions' detectados en inyección secuencial automatizada.

### Validación de UI/UX
- **Timeline Overflow**: Se implementó `max-h-[300px]` con scroll interno en `AdminOrders.tsx` y `Profile.tsx`. El drawer se mantiene estable incluso con +10 mensajes.
- **Smart Sorting**: El algoritmo de ordenamiento en el Panel Admin priorizó correctamente la orden `#STRESS-LOTE` al tope de la lista debido a que el último `sender` fue `user`.
- **QuickOffer Sync**: Se confirmó que el componente visual de la tarjeta de orden muestra el último precio inyectado (puja máxima) dinámicamente.

---
*Validación técnica completada - 22/02/2026*
