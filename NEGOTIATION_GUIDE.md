# NEGOTIATION_GUIDE.md

## Sistema de Negociación Bidireccional (Loop de Stitch)

Este documento describe la arquitectura y el flujo de trabajo del sistema de negociación implementado para gestionar las ofertas entre **Oldie but Goldie (OBG)** y sus clientes.

### 1. Esquema de Datos (Firestore)

Utilizamos un enfoque de **Historial de Negociación** (Opción A) en lugar de sobrescribir campos estáticos. Esto permite trazabilidad, auditoría y una mejor experiencia de resolución de disputas.

- **Campo**: `negotiationHistory` (Array de Objetos)
- **Operación**: `arrayUnion` (Garantiza inmutabilidad de registros previos)

```typescript
interface NegotiationEntry {
  price: number;
  currency: "ARS" | "USD";
  sender: "admin" | "user"; // Identifica quién realizó la propuesta
  timestamp: ServerTimestamp | Date;
  message?: string; // (Opcional) Para futuras notas
}
```

### 2. Ciclo de Negociación (Loop)

1. **Propuesta Inicial (User)**: Se registra en `totalPrice`.
2. **Contraoferta Admin**: Se añade entrada con `sender: admin` al historial.
3. **Contraoferta Usuario**: Se añade entrada con `sender: user` al historial.
4. **Cierre (Accept)**: El estado cambia a `completed` y se genera el recibo final.

### 3. Manejo de Contraofertas "Infinitas"

Para evitar que el estado global se rompa o que la interfaz sea inmanejable:
- **Priorización UI**: Las órdenes se ordenan dinámicamente. Si el último `sender` es `user`, la orden sube al tope del Panel Admin (`[ACCIÓN REQUERIDA]`).
- **Timeline UI**: Las propuestas se visualizan en un eje central. Admin a la izquierda, Usuario a la derecha. Esto facilita la lectura del histórico sin importar cuántas ofertas se hayan cruzado.
- **Validaciones**: Se impide el envío de ofertas vacías, negativas o iguales a 0 en ambos lados.

### 4. Componentes Clave

- `AdminOrders.tsx`: Gestión centralizada y visualización Timeline (Admin).
- `Profile.tsx`: Respuesta del cliente y visualización Timeline (Usuario).
- `OrderCard.tsx`: Resumen visual y componente `QuickOffer` para respuestas rápidas del Admin.

### 5. Mejores Prácticas
- Siempre usar `arrayUnion` para añadir entradas.
- No delegar el cálculo del precio final al cliente; el Admin debe validar el cierre.
- Utilizar `framer-motion` para el feedback visual (`Celebration`) al momento del cierre.
