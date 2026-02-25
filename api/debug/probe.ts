import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        steps: []
    };

    try {
        report.steps.push("1. Reading Env");
        const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        let sa: any = {};
        if (creds && creds.trim().startsWith('{')) {
            sa = JSON.parse(creds);
        } else {
            sa = {
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY
            };
        }

        report.steps.push("2. Extracting Key");
        let raw = (sa.private_key || sa.privateKey || '').trim();
        if (raw.startsWith('{')) {
            try { raw = JSON.parse(raw).private_key || raw; } catch (e) { }
        }

        report.steps.push("3. Atomic Vacuum V2");
        const body = raw
            .replace(/\\n/g, '\n')
            .replace(/-----[^-]*-----/g, '')
            .replace(/\s/g, '')
            .trim();

        report.body_length = body.length;

        const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

        const config = {
            projectId: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim().replace(/^["']|["']$/g, ''),
            clientEmail: (sa.client_email || sa.clientEmail || '').trim().replace(/^["']|["']$/g, ''),
            privateKey: finalKey
        };
        report.config_keys = Object.keys(config);
        report.project_id = config.projectId;

        report.steps.push("4. Initializing Admin SDK");
        // We use a temporary app name to avoid collision
        const tempApp = initializeApp({
            credential: cert(config)
        }, 'probe-app-' + Date.now());

        report.steps.push("5. Testing Firestore Connectivity");
        const db = getFirestore(tempApp);
        const collections = await db.listCollections();
        report.collections_count = collections.length;

        report.status = "SUCCESS: Firebase initialized and Firestore reached.";

    } catch (e: any) {
        report.status = "FAILURE";
        report.error_name = e.name;
        report.error_message = e.message;
        report.error_stack = e.stack;
    }

    return res.status(200).json(report);
}
