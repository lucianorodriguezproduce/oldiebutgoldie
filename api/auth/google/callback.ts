import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PROTOCOLO: CRITICAL-DEBUG-AUTONOMY (Forensic Cleanup)
let rawKey = process.env.FIREBASE_PRIVATE_KEY || '';

// 1. Detección Base64 y Decodificación
let privateKey = rawKey.includes('LS0t')
    ? Buffer.from(rawKey.trim(), 'base64').toString('utf-8')
    : rawKey;

// 2. Limpieza Quirúrgica Profunda
privateKey = privateKey
    .replace(/^["']|["']$/g, '') // Quitar comillas externas (dobles o simples)
    .replace(/\\n/g, '\n')       // Convertir escapes literales \n a saltos reales
    .replace(/\r/g, '')          // Eliminar retornos de carro
    .replace(/ +/g, ' ')         // Colapsar espacios múltiples (posibles copypaste bugs)
    .trim();

// 3. Diagnóstico Forense: Mapeo ASCII para encontrar "saboteadores" invisibles
if (privateKey.length > 0) {
    const chars = privateKey.substring(0, 50).split('').map(c => c.charCodeAt(0)).join(',');
    console.log(`FORENSIC ANALYTICS: Size=${privateKey.length} bytes. ASCII(0-50)=[${chars}]`);
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
