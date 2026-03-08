# Manual del Guerrero: Guía de Contribución

Bienvenido al Búnker. Para mantener la estabilidad de **Oldie But Goldie**, todo recluta debe seguir estos protocolos.

## 1. Patrulla de Robots (Playwright)

Antes de cada despliegue o cambio en flujos críticos, debes ejecutar los robots de prueba.

### Comandos de Inspección
- **Ejecutar todos los tests**: `npm run test:e2e`
- **Inspección Visual (UI Mode)**: `npx playwright test --ui`
- **Ver Reporte de Daños**: `npm run test:e2e:report`

### Flujos Protegidos
- **Camino del Guerrero**: No rompas el flujo de compra desde el archivo.
- **Persistencia de Batea**: Asegura que el LocalStorage se mantenga íntegro.

## 2. Sistema de Alerta Temprana (Sentry)

Si el búnker experimenta un fallo catastrófico en producción, Sentry capturará el evento.

### Cómo Interpretar Sentry
1. **Event ID**: Ante un reporte de usuario, busca el ID en el dashboard de Sentry.
2. **Contexto de Usuario**: Revisa el UID capturado para entender si el problema es específico de un perfil.
3. **Breadcrumbs**: Analiza la navegación previa al error para reproducir el fallo.

## 3. Despliegue Soberano (Vercel)

El búnker se actualiza automáticamente al hacer push a la rama principal. No obstante, si Playwright falla, Vercel detendrá el despliegue.

---
**Recuerda**: El código que no se prueba es código que no existe.
