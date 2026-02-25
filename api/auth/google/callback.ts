import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: PEM-REWRAP-STABILIZER (Architectural Identity Reset)
const getAdminConfig = () => {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentials) throw new Error('GOOGLE_APPLICATION_CREDENTIALS missing');

    // Parse JSON if it's a string (standard Vercel/Env behavior)
    let serviceAccount;
    try {
        serviceAccount = typeof credentials === 'string' && credentials.trim().startsWith('{')
            ? JSON.parse(credentials)
            : null;
    } catch (e) {
        console.error('JSON Parse failed for GOOGLE_APPLICATION_CREDENTIALS');
    }

    if (!serviceAccount) {
        serviceAccount = {
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY
        };
    }

    const rawKey = (serviceAccount.private_key || serviceAccount.privateKey || '').trim();
    let decodedKey = rawKey.includes('LS0t')
        ? Buffer.from(rawKey.replace(/^["']|["']$/g, ''), 'base64').toString('utf-8')
        : rawKey;

    decodedKey = decodedKey.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\r/g, '').replace(/\\ /g, ' ');

    const header = '-----BEGIN PRIVATE KEY-----';
    const footer = '-----END PRIVATE KEY-----';
    let cleanBase64 = decodedKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
    const lines = cleanBase64.match(/.{1,64}/g) || [];
    const finalKey = `${header}\n${lines.join('\n')}\n${footer}`;

    return {
        projectId: (serviceAccount.project_id || serviceAccount.projectId || '').trim().replace(/^["']|["']$/g, ''),
        clientEmail: (serviceAccount.client_email || serviceAccount.clientEmail || '').trim().replace(/^["']|["']$/g, ''),
        privateKey: finalKey,
    };
};

const app = getApps().length === 0
    ? initializeApp({ credential: cert(getAdminConfig()) })
    : getApp();

const db = getFirestore(app);

/**
 * Callback handler for GSC OAuth2.
 * Interchanges the code for tokens and stores the refresh_token.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;

    console.log(process.env.GOOGLE_CLIENT_ID ? 'Callback: GOOGLE_CLIENT_ID Detectado' : 'Callback: GOOGLE_CLIENT_ID Faltante');

    if (!code) {
        return res.status(400).send('No code provided');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
    );

    try {
        const { tokens } = await oauth2Client.getToken(code as string);

        // Persist the refresh token in Firestore
        if (tokens.refresh_token) {
            await db.collection('system_config').doc('gsc_auth').set({
                refresh_token: tokens.refresh_token,
                last_updated: new Date().toISOString(),
                status: 'active'
            }, { merge: true });

            // Redirect back to the Admin Dashboard
            res.redirect('/admin/analytics?gsc=success');
        } else {
            console.warn('GSC Callback: No refresh_token returned. User might need to re-consent.');
            res.redirect('/admin/analytics?gsc=partial');
        }
    } catch (error) {
        console.error('GSC OAuth Callback Error:', error);
        res.redirect('/admin/analytics?gsc=error');
    }
}
