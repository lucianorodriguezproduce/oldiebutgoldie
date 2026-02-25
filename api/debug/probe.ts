import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

/**
 * PROTOCOLO BLACK BOX: FORENSIC IDENTITY PROBE
 * This handler analyzes the integrity of GOOGLE_APPLICATION_CREDENTIALS
 * without attempting to initialize Firebase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const rawEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const report: any = {
        timestamp: new Date().toISOString(),
        env_type: typeof rawEnv,
        env_exists: !!rawEnv,
        env_length: typeof rawEnv === 'string' ? rawEnv.length : 'N/A',
    };

    if (!rawEnv) {
        return res.status(500).json({ error: 'ENV MISSING', report });
    }

    // AUDIT 1: NESTING DETECTION
    let sa;
    let nesting_error = false;
    try {
        if (typeof rawEnv === 'string') {
            if (rawEnv.trim().startsWith('{')) {
                sa = JSON.parse(rawEnv);
                report.parse_method = 'JSON_STRING';
            } else {
                report.parse_method = 'RAW_STRING';
                sa = { private_key: rawEnv };
            }
        } else if (typeof rawEnv === 'object') {
            sa = rawEnv;
            report.parse_method = 'OBJECT_NESTING_DETECTED';
        }
    } catch (e) {
        nesting_error = true;
        report.parse_error = (e as Error).message;
    }

    const privateKey = sa?.private_key || sa?.privateKey || '';
    report.key_exists = !!privateKey;
    report.key_length = privateKey.length;

    if (privateKey) {
        // MISSION A: SHA-256 HASH
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        report.sha256 = hash;

        // MISSION B: BYTE OF RUPTURE (Trailing ASCII)
        const last20 = privateKey.slice(-20);
        report.trailing_text = last20;
        report.trailing_ascii = last20.split('').map((c: string) => c.charCodeAt(0));

        report.has_begin_marker = privateKey.includes('-----BEGIN PRIVATE KEY-----');
        report.has_end_marker = privateKey.includes('-----END PRIVATE KEY-----');
    }

    return res.status(200).json(report);
}
