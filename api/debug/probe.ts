import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import admin from 'firebase-admin';
const secretClient = new SecretManagerServiceClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        version_sig: "BUNKER-STABILIZED-V3",
        steps: []
    };

    try {
        report.steps.push("1. Accessing Bunker (Secret Manager)");
        const [version] = await secretClient.accessSecretVersion({
            name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
        });

        const payload = version.payload?.data?.toString();
        if (!payload) throw new Error('Secret payload empty');

        let serviceAccount;
        try {
            serviceAccount = typeof payload === 'string' ? JSON.parse(payload) : payload;
        } catch (e) {
            throw new Error("ERROR_CRITICO: El secreto del búnker no es un JSON válido.");
        }

        if (!serviceAccount.project_id || !serviceAccount.private_key) {
            throw new Error("ERROR_CRITICO: Objeto de identidad incompleto tras el parseo.");
        }

        report.steps.push("2. Initializing Admin SDK (Direct Inject)");
        const tempApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, 'probe-bunker-' + Date.now());

        report.steps.push("3. Testing Firestore Connectivity");
        const db = admin.firestore(tempApp);
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
