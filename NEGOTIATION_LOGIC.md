# Sistema de Negociación: Lógica de Negocio y Flujo de Estados

Este documento describe la arquitectura y las reglas de negocio del sistema de negociación bidireccional entre el Administrador y el Usuario. Su objetivo es servir como "fuente de verdad" para futuras iteraciones sin romper el flujo crítico.

## 1. Modelo de Datos (Extensión de `orders`)
El sistema utiliza campos específicos en el documento de la orden para gestionar las ofertas:

*   **`adminPrice` (number):** El valor monetario propuesto por Oldie but Goldie.
*   **`adminCurrency` (string):** La moneda elegida para la oferta (`ARS` | `USD`).
*   **`totalPrice` (number):** El valor aceptado final o la contraoferta del usuario.
*   **`status` (string):** El orquestador del flujo.

## 2. Los Estados del Trato
El flujo sigue una máquina de estados estricta para evitar inconsistencias visuales:

1.  **`pending` / `negotiating`**: El estado inicial. El usuario envía su lote sin precio definido (o con uno orientativo).
2.  **`quoted` (con `adminPrice` > 0)**: El Admin asigna un valor. Esto activa el `NegotiationBanner` en la vista del usuario.
3.  **`venta_finalizada`**: El usuario hace clic en **[ACEPTAR]**. El banner desaparece y es reemplazado por instrucciones de pago y contacto WhatsApp.
4.  **`counteroffered`**: El Admin propone un precio directo.

## 3. Disparadores de Interfaz (Triggers)
*   **Aparición del Banner**: Se muestra en `Profile.tsx` si `selectedOrder.adminPrice > 0` Y el status NO ES `venta_finalizada` ni `completed`.
*   **Sincronización en Tiempo Real**: Ambos paneles (`Profile` y `AdminOrders`) utilizan `onSnapshot` con un efecto de sincronización secundaria para `selectedOrder`, asegurando que si el Admin cambia el precio con el drawer del usuario abierto, los cambios se reflejen instantáneamente.

## 4. Acciones Críticas
*   **Aceptar Oferta**: Actualiza `status` a `venta_finalizada` e inyecta `acceptedAt` (timestamp).
*   **Rechazar Oferta**: Revierte `status` a `negotiating` para permitir que el canal de chat siga abierto sin la presión de la oferta actual.

## 5. Glosario Visual (Contexto para Stitch)
*   **Action Color:** Burnt Orange (#FB923C) para indicar que hay una acción requerida (Oferta).
*   **Success Color:** Neon Volt (#CCFF00) para cuando el trato ha sido cerrado satisfactoriamente.
*   **Iconografía:** `Handshake` para negociaciones, `BadgeDollarSign` para precios finales.

---
**Nota de Mantenimiento:** Cualquier cambio en la validación de `adminPrice` debe replicarse tanto en el componente `NegotiationBanner` como en los guardianes de lógica de `Profile.tsx`.
