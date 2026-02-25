import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: NUCLEAR-PEM-RECONSTRUCTION
let rawKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();

// 1. Detección y Limpieza Prematura de Comores e Inyecciones
rawKey = rawKey.replace(/^["']|["']$/g, '');

// 2. Decodificación Base64 si aplica
let privateKey = rawKey.includes('LS0t')
    ? Buffer.from(rawKey, 'base64').toString('utf-8')
    : rawKey;

// 3. Normalización Física de PEM
privateKey = privateKey
    .replace(/\\n/g, '\n') // Normalizar escapes literales
    .replace(/\\r/g, '')   // Quitar retornos literales
    .replace(/\r/g, '')    // Quitar retornos reales
    .replace(/\\ /g, ' ')  // Corregir espacios escapados (saboteadores comunes)
    .trim();

// 4. Extracción Estructural: Filtrar solo el bloque PEM puro
const header = '-----BEGIN PRIVATE KEY-----';
const footer = '-----END PRIVATE KEY-----';
if (privateKey.includes(header) && privateKey.includes(footer)) {
    const startIndex = privateKey.indexOf(header);
    const endIndex = privateKey.indexOf(footer) + footer.length;
    privateKey = privateKey.substring(startIndex, endIndex);
}

// 5. Diagnóstico Final
if (privateKey.length > 0) {
    const map = privateKey.substring(0, 50).split('').map(c => c.charCodeAt(0)).join(',');
    console.log(`NUCLEAR RECONSTRUCTION: Coupled=${privateKey.length} bytes. ASCII=[${map}]`);
}

const adminConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
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
