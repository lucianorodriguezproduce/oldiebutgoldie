import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const report: any = {
        timestamp: new Date().toISOString(),
        env_keys: Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('FIREBASE')),
        audit: {}
    };

    const targetVars = ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_PRIVATE_KEY'];

    for (const varName of targetVars) {
        const val = process.env[varName] || '';
        const audit: any = {
            exists: !!val,
            length: val.length,
            is_json: val.trim().startsWith('{'),
            is_path: (val.includes('/') || val.includes('\\')) && !val.includes(' '),
            first_chars: val.slice(0, 20),
            last_chars: val.slice(-20),
            char_codes: val.slice(-10).split('').map(c => c.charCodeAt(0))
        };

        if (audit.is_json) {
            try {
                const parsed = JSON.parse(val);
                audit.parsed_keys = Object.keys(parsed);
                const pk = parsed.private_key || parsed.privateKey || '';
                audit.pk_length = pk.length;
                audit.pk_hash = crypto.createHash('sha256').update(pk).digest('hex');
            } catch (e: any) {
                audit.parse_error = e.message;
            }
        }
        report.audit[varName] = audit;
    }

    return res.status(200).json(report);
}
