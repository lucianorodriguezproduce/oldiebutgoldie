# Mapa de Dependencias del Búnker

Este diagrama ilustra cómo fluye la información y el control entre los componentes soberanos.

```mermaid
graph TD
    subgraph "Capas de Usuario"
        UI[App React / Vite]
        Auth[Firebase Auth]
    end

    subgraph "Capa de Datos (Soberanía)"
        Firestore[(Firestore DB)]
        Storage[Google Cloud Storage]
    end

    subgraph "Insumos Externos"
        Discogs[Discogs API]
    end

    subgraph "Sensores y Radar"
        GTM[Google Tag Manager]
        GA4[Google Analytics 4]
        Looker[Radar Looker Studio]
        Sentry[Alerta Sentry]
    end

    subgraph "Plataforma"
        Vercel[Vercel Hosting/CI-CD]
        Playwright[Robots Playwright]
    end

    UI <--> Firestore
    UI <--> Auth
    UI -- "Eventos DataLayer" --> GTM
    GTM --> GA4
    GA4 --> Looker
    UI -- "Importar" --> Discogs
    Discogs -- "Snapshot" --> Firestore
    Vercel -- "Auto-Deploy" --> UI
    Playwright -- "Inspección" --> UI
    UI -- "Kernel Panic" --> Sentry
```

### Componentes Clave:
- **Admin**: Gestiona el `Looker Studio` y el `site_config`.
- **Archivo**: Unifica el catálogo global y batea privada.
- **Vercel**: Orquesta el despliegue y telemetría de plataforma.
- **Google Analytics**: Fuente primaria para el Radar de Inteligencia.
