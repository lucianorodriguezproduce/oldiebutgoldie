# Guía de Negociación y Ecosistema OBG

Esta guía documenta el flujo de trabajo bidireccional entre la administración y los coleccionistas, así como los mecanismos técnicos de soporte.

## 1. Flujo de Estados de Negociación

El sistema utiliza Firestore como bus de eventos en tiempo real para coordinar el trato:

1.  **Lote Enviado (`pending`)**: El usuario envía una solicitud de compra o venta.
2.  **Cotización Admin (`quoted`)**: El administrador asigna un precio sugerido (`adminPrice`).
3.  **Oferta Enviada (`offer_sent`)**: El administrador activa la fase de negociación.
    -   *Activador Técnico*: El hook `useOrderNotifications` detecta este estado y enciende el **Pulse Dot** en el Navbar del usuario.
4.  **Aceptación Usuario (`venta_finalizada`)**: El usuario acepta la oferta.
    -   *Acciones Automáticas*: Se genera el **Comprobante de Trato**. El botón de WhatsApp cambia a "Coordinar Entrega".
5.  **Rechazo/Cancelación (`rejected`/`cancelled`)**: La orden se archiva.

## 2. Arquitectura de Notificaciones

### `useOrderNotifications.ts`
Este hook centraliza la escucha de Firestore para evitar múltiples conexiones.
- **Filtros**: `user_id == current_uid` && `status == offer_sent`.
- **UI**: Inyecta el estado `hasActiveOffer` en el `Navbar`.

## 3. Sistema de Recibos e Impresión

Para garantizar la formalidad del trato, el sistema de impresión se basa en aislamiento por CSS:

- **Efecto Print**: Se utiliza `@media print` para ocultar el Layout web y el Drawer, dejando visible únicamente el contenedor `#printable-receipt`.
- **Optimización**: Se fuerzan fondos blancos y textos negros para ahorro de tinta y legibilidad profesional.

## 4. Gestión de Activos (Performance)

- **Lazy Loading**: Aplicado vía `loading="lazy"` en todos los assets de baja prioridad.
- **Intersección (Skeleton)**: El componente `LazyImage` utiliza Skeletons de `shadcn-ui` como placeholder absoluta hasta que el evento `onLoad` de la imagen se dispara, eliminando el Cumulative Layout Shift (CLS).

---
*Mantenido por el equipo Oldie but Goldie - 2026*
