import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// NEUTRALIZACIÓN DIFERIDA DE INFRAESTRUCTURA (Búnker)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/')) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const secretClient = new SecretManagerServiceClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        version_sig: "BUNKER-STABILIZED",
        steps: []
    };

    try {
        report.steps.push("1. Accessing Bunker (Secret Manager)");
        const [version] = await secretClient.accessSecretVersion({
            name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
        });

        const payload = version.payload?.data?.toString();
        if (!payload) throw new Error('Secret payload empty');

        const sa = JSON.parse(payload);

        // RECONSTRUCCIÓN CUALIFICADA (Garantizar compatibilidad total)
        const rawKey = (sa.private_key || sa.privateKey || '').trim();
        const body = rawKey
            .replace(/\\n/g, '\n')
            .replace(/-----[^-]*-----/g, '')
            .replace(/\s/g, '')
            .trim();

        const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

        const config = {
            project_id: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim(),
            client_email: (sa.client_email || sa.clientEmail || '').trim(),
            private_key: finalKey
        };

        report.steps.push("2. Initializing Admin SDK (Direct Inject)");
        const tempApp = initializeApp({
            credential: cert(config as any)
        }, 'probe-bunker-' + Date.now());

        report.steps.push("3. Testing Firestore Connectivity");
        const db = getFirestore(tempApp);
        const collections = await db.listCollections();
        report.collections_count = collections.length;

        report.status = "SUCCESS: Bunker Identity Stabilized.";

    } catch (e: any) {
        report.status = "FAILURE";
        report.error_name = e.name;
        // REDACCIÓN DE SEGURIDAD (Búnker)
        const safeMessage = (e.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");
        report.error_message = safeMessage;
        report.error_stack = e.stack?.includes("service_account") ? "Stack redacted for security" : e.stack;
    }

    return res.status(200).json(report);
}
