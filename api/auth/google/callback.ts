import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: PEM-REWRAP-STABILIZER (Definitive Fix)
const normalizeEnvVar = (val: string | undefined) => (val || '').trim().replace(/^["']|["']$/g, '');

const rawKey = normalizeEnvVar(process.env.FIREBASE_PRIVATE_KEY);
let decodedKey = rawKey.includes('LS0t')
    ? Buffer.from(rawKey, 'base64').toString('utf-8')
    : rawKey;

// 1. Normalización de Escapes
decodedKey = decodedKey
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\r/g, '')
    .replace(/\\ /g, ' ');

// 2. Re-envoltorio Estricto (Nuclear PEM Reset)
const header = '-----BEGIN PRIVATE KEY-----';
const footer = '-----END PRIVATE KEY-----';

// Extraer solo la data base64, eliminando cualquier espacio o marker previo
let cleanBase64 = decodedKey
    .replace(header, '')
    .replace(footer, '')
    .replace(/\s/g, '');

// Re-envolver cada 64 caracteres (estándar RFC 7468 / OpenSSL)
const lines = cleanBase64.match(/.{1,64}/g) || [];
const finalKey = `${header}\n${lines.join('\n')}\n${footer}`;

const adminConfig = {
    projectId: normalizeEnvVar(process.env.FIREBASE_PROJECT_ID),
    clientEmail: normalizeEnvVar(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: finalKey,
};

const app = getApps().length === 0
    ? initializeApp({ credential: cert(adminConfig) })
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
