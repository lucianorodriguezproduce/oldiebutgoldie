import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert } from 'firebase-admin/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        env: {}
    };

    try {
        const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
        report.env.creds_length = creds.length;
        report.env.creds_first_10 = creds.slice(0, 10);
        report.env.creds_last_10 = creds.slice(-10);

        let sa: any = {};
        if (creds.trim().startsWith('{')) {
            sa = JSON.parse(creds);
            report.env.format = "JSON";
        } else {
            sa = {
                private_key: process.env.FIREBASE_PRIVATE_KEY,
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL
            };
            report.env.format = "FALLBACK";
        }

        const raw = (sa.private_key || sa.privateKey || '').trim();
        report.raw_length = raw.length;

        const body = raw
            .replace(/\\n/g, '\n')
            .replace(/-----[^-]*-----/g, '')
            .replace(/\s/g, '')
            .trim();

        report.body_length = body.length;
        report.body_preview_start = body.slice(0, 32);
        report.body_preview_end = body.slice(-32);

        // Check for non-base64 chars
        const illegal = body.replace(/[A-Za-z0-9+/=]/g, '');
        report.illegal_chars = illegal.length > 0 ? illegal : "NONE";
        if (illegal.length > 0) {
            report.illegal_codes = illegal.split('').map(c => c.charCodeAt(0));
        }

        const finalKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;

        const config = {
            projectId: (sa.project_id || sa.projectId || 'buscador-discogs-11425').trim().replace(/^["']|["']$/g, ''),
            clientEmail: (sa.client_email || sa.clientEmail || '').trim().replace(/^["']|["']$/g, ''),
            privateKey: finalKey
        };

        // Attempt Buffer conversion
        const buffer = Buffer.from(body, 'base64');
        report.buffer_size = buffer.length;
        report.buffer_head = buffer.slice(0, 10).toString('hex');

        // Attempt Ignition
        initializeApp({ credential: cert(config) }, 'test-' + Date.now());
        report.status = "SUCCESS";

    } catch (e: any) {
        report.status = "FAILURE";
        report.error = e.message;
        report.stack = e.stack;
    }

    return res.status(200).json(report);
}
