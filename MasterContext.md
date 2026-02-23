# MasterContext - Mapeo Genético del Flujo Transaccional y Sincronización de Identidades

Este documento detalla exhaustivamente las rutas de datos involucradas desde que un usuario (coleccionista) interactúa con un disco hasta que se cierra una negociación en la plataforma "Oldie but Goldie" construida sobre Firebase.

---

## 1. Esquema de Colección `orders`

El esquema JSON exacto de un documento dentro de la colección `orders` en Firestore depende de si la orden fue originada desde un disco individual (`Home.tsx`) o si es un lote.

### Campos Principales
```json
{
  "user_id": "UID_DEL_USUARIO_COMPRADOR_VENDEDOR",
  "user_email": "example@email.com",
  "user_name": "Nombre Usuario",
  "user_photo": "URL_PHOTO_O_VACIO",
  "order_number": "#ORD-XYZ12",
  "item_id": 123456, // ID del disco de Discogs
  "thumbnailUrl": "URL_IMAGEN",
  "timestamp": "Timestamp_Firebase",
  "createdAt": "Timestamp_Firebase",
  "status": "pending", // Estados: pending, quoted, negotiating, contraoferta_usuario, pending_acceptance, offer_sent, venta_finalizada, completed, cancelled
  "type": "COMPRAR" // o "VENDER". Refleja la intención original del usuario.
}
```

### El objeto `details`
Este objeto contiene las especificaciones y precios del disco individual en cuestión:
```json
"details": {
  "format": "Vinyl, LP, Album",
  "condition": "Mint (M)",
  "intent": "COMPRAR", // o "VENDER"
  "artist": "Nombre del Artista",
  "album": "Título del Álbum",
  "cover_image": "URL_THUMBNAIL",
  
  // Condicionales (Aparecen si la intención es VENDER)
  "price": 10000, 
  "currency": "ARS" // o "USD"
}
```

### Información de Negociación y Precios (Agregados durante el flujo)
A medida que el administrador interactúa, se inyectan nuevos campos a la raíz del documento:
```json
  "market_reference": 150.50, // Precio extraído de Discogs lowest_price
  "adminPrice": 8000, // Precio de contraoferta del administrador (para compras a usuarios)
  "adminCurrency": "ARS",
  "admin_offer_price": 15000, // Precio de cotización (venta a usuarios)
  "admin_offer_currency": "ARS",
  "totalPrice": 9000, // Precio resultante de una contraoferta del usuario
```

### Arreglo de Historial de Negociación (`negotiationHistory`)
```json
"negotiationHistory": [
  {
    "price": 8000,
    "currency": "ARS",
    "sender": "admin", // o "user"
    "timestamp": "Timestamp_Firebase",
    "message": "Mensaje opcional de contraoferta" // Ej: "¡Quiero contraofertar!"
  }
]
```

### Pedidos "Por Lote" (`isBatch: true`)
Si el pedido es un lote procesado desde una vista diferente, se omiten algunos campos de `details` y en su lugar el documento posee:
```json
"isBatch": true,
"items": [
  {
    "id": 123456,
    "title": "Album Title",
    "artist": "Artist Name",
    "format": "Vinyl, LP",
    "condition": "Mint (M)",
    "cover_image": "URL",
    "status": "pending"
  }, ...
]
```

---

## 2. Diferenciación de Identidades (Lógica de Roles)

El sistema **NO** utiliza Custom Claims en Firebase Auth, ni almacena el rol en una colección separada de "Users". 

La verificación es completamente del lado del cliente y se define en **`AuthContext.tsx`**.
La diferenciación se realiza de dos maneras:
1.  **Validación Hardcodeada**: Busca explícitamente el email `"admin@discography.ai"`.
2.  **Validación de Sesión Guardada**: Utiliza la clave `admin_session` de `localStorage` como respaldo si superpone la validación estricta de firebase.

```typescript
// extracto de src/context/AuthContext.tsx
const [isMasterAdmin, setIsMasterAdmin] = useState(() => {
    return localStorage.getItem("admin_session") === "true";
});

// Durante onAuthStateChanged:
if (currentUser?.email === "admin@discography.ai") {
    localStorage.setItem("admin_session", "true");
    setIsMasterAdmin(true);
}

// Variable expuesta:
const isAdmin = !!user && (isMasterAdmin || user.email === "admin@discography.ai");
```

Del lado del administrador, cualquier usuario autenticado cuyo email coincida con ese *string* o tenga el storage flag, verá la interfaz de `AdminDashboard` o `AdminOrders` (las rutas `/admin/*` están protegidas por el componente `ProtectedRoute` que chequea `isAdmin`).

---

## 3. Interfaz y Lógica de Comunicación (Negociación)

La comunicación dentro de la web no consta de un chat integrado con texto libre general para mensajes. Es estrictamente un **sistema de negociación de precios push/pull** (Bidireccional) que interactúa con el botón de **WhatsApp** final para la coordinación y logística.

### El Flujo "Ping-Pong" de Negociación
1.  **Inicio (Usuario)**: El usuario inicia un pedido de compra ("Quiero que me consigas X") o un pedido de venta ("Quiero venderte X por $100"). Se genera el doc con `status: 'pending'`.
2.  **Respuesta (Admin - en `AdminOrders.tsx`)**: 
    -   Si el usuario intentó **VENDER**: El admin puede proponer otro precio ingresando `quotePrice`, lo cual setea `adminPrice` en el documento y anexa un objeto con `sender: 'admin'` al arreglo `negotiationHistory`.
    -   Si el usuario intentó **COMPRAR**: El admin cotiza el disco y setea `admin_offer_price`, lo cual cambia el estado a `quoted`.
3.  **Contra-respuesta (Usuario - en `Profile.tsx` y `NegotiationBanner.tsx`)**: 
    -   El usuario ve la cotización/oferta del administrador. Tiene dos opciones que ejecutan mutaciones directas:
        -   **Aceptar**: Pasa el status a `venta_finalizada` y bloquea nuevas ofertas comerciales. Muestra la pantalla de celebración.
        -   **Contraoferta**: Ingresa un nuevo precio que actualiza el `totalPrice`, el status cambia a `contraoferta_usuario`, inyecta un objeto al historial con `sender: 'user'` y levanta una notificación en Firestore avisando al administrador de la disconformidad de precio.
4.  **Cierre**: Toda negociación dentro de la aplicación es puramente económica. Al llegarse al estado `venta_finalizada`, se le revela u ofrece al usuario el botón de contactar por **WhatsApp** directamente, anexando en la url el detalle del arreglo pre-acordado para coordinar pago/envío.

*(Las notificaciones visuales entre partes se manejan paralelamente insertando un documento de alerta en la colección `notifications` atada a ese `order.id` y `user.uid`).*

---

## 4. Estado Físico del Inventario (Vinilos)

Respecto a si el sistema marca un disco como "SOLD" o reajusta stock... 
El sistema es una plataforma de **Lead Generation y Marketplace / Cotizador asíncrono**. No gestiona un inventario duro deductivo ni está acoplado a un e-commerce tradicional dentro de su propio motor de base de datos.
La procedencia de los ítems deriva de la API oficial de **Discogs** (consumida a través de `discogsService.ts`). 

1.  **Aceptación de Oferta**: Cuando un usuario clickea *"Aceptar"* la orden solo muta su propio estado de vida (`status: 'venta_finalizada'` o `completed`).
2.  **No hay stock a deducir en la web**: La base de datos no contiene una colección de "Inventario Interno". En vez de eso, la plataforma usa IDs de 'Releases' o 'Masters' genéricos de Discogs (ej. `item_id: 123456`) que pueden ser pedidos infinitas veces por incontables coleccionistas. El administrador utiliza los pedidos como un intermediador/hunter.

**Conclusión:** El proceso de control de unidades físicas que tiene guardadas el admin en su tienda, o de los vinilos que consigue post-pedido, es estrictamente **manual**. Validar y dar de baja el artículo en su stock real/físico lo ejecuta el Administrador por fuera del contexto digital de "Stitch" o cerrando la orden como "Completado" visualmente.
