import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Client initialized at module level - will use ADC if available
const secretClient = new SecretManagerServiceClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        version_sig: "BUNKER-OMEGA-3.0",
        steps: []
    };

    try {
        report.steps.push("1. Accessing Bunker (Secret Manager)");
        // El cliente necesita las credenciales de entorno para esta llamada
        const [version] = await secretClient.accessSecretVersion({
            name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
        });

        const payload = version.payload?.data?.toString();
        if (!payload) throw new Error('Secret payload empty');
        report.steps.push("2. Payload Retried");

        // PREVENCIÓN DE INFERENCIA DE RUTA (Solo tras recuperar el secreto)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            report.steps.push("2.5. Unsetting GOOGLE_APPLICATION_CREDENTIALS for Firebase safety");
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }

        const sa = JSON.parse(payload);
        const rawKey = (sa.private_key || sa.privateKey || '').trim();

        // FILTRO DE VACÍO (Seguridad Bunker)
        const body = rawKey
            .replace(/\\n/g, '\n')
            .replace(/-----[^-]*-----/g, '')
            .replace(/\s/g, '')
            .trim();

        report.body_length = body.length;

        const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

        // SCHEMA ESTÁNDAR (SNAKE_CASE)
        const config = {
            project_id: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim(),
            client_email: (sa.client_email || sa.clientEmail || '').trim(),
            private_key: finalKey
        };
        report.project_id = config.project_id;

        report.steps.push("3. Initializing Admin SDK (Bunker Code)");
        const tempApp = initializeApp({
            credential: cert(config as any)
        }, 'probe-bunker-' + Date.now());

        report.steps.push("4. Testing Firestore Connectivity");
        const db = getFirestore(tempApp);
        const collections = await db.listCollections();
        report.collections_count = collections.length;

        report.status = "SUCCESS: Bunker Identity Stabilized Omega-3.0.";

    } catch (e: any) {
        report.status = "FAILURE";
        report.error_name = e.name;
        report.error_message = e.message;
        report.error_stack = e.stack;
    }

    return res.status(200).json(report);
}
