import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from '../lib/bunker';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        version_sig: "BUNKER-CENTRALIZED-V1",
        steps: []
    };

    try {
        report.steps.push("1. Invoking Centralized Bunker Identity");
        const db = await initBunkerIdentity();

        report.steps.push("2. Verifying Firestore Object");
        const collections = await db.listCollections();
        report.collections_count = collections.length;

        report.status = "SUCCESS: Centralized Identity Stabilized.";

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
