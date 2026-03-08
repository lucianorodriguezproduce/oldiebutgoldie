import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import { HelmetProvider } from 'react-helmet-async';
import './index.css'
import App from './App.tsx'

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "https://1f92ece5ebb1cb47e1c5cf95d24d11f6@o4511010851129344.ingest.us.sentry.io/4511010893531136",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: "production",
  });
  Sentry.captureMessage("Soberanía Técnica: Señal Recibida");
}

import { HealthProvider } from './context/HealthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <HealthProvider>
        <App />
      </HealthProvider>
    </HelmetProvider>
  </StrictMode>,
)
