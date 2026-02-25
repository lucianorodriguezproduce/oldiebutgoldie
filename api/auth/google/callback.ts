import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Manual Identity Override with Safeguards)
if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;

    // VERIFICACIÓN DE LONGITUD (Safeguard)
    if (rawKey && rawKey.length < 1600) {
        console.error('CRITICAL: FIREBASE_PRIVATE_KEY is truncated (KEY_TRUNCATED). Length:', rawKey.length);
        // We throw to prevent the handler from proceeding with a broken identity
        throw new Error('KEY_TRUNCATED');
    }

    // INTEGRIDAD DE SALTO (Jump Integrity)
    // Asegura que cada '\n' se convierta en un salto de línea real y limpia comillas incidentales
    // FILTRADO DE COMILLAS (Double-Escape Shielding)
    // Elimina comillas exteriores si existen antes de procesar saltos
    let sanitizedKey = rawKey?.trim() || '';
    if (sanitizedKey.startsWith('"') && sanitizedKey.endsWith('"')) {
        sanitizedKey = sanitizedKey.substring(1, sanitizedKey.length - 1);
    }

    const privateKey = sanitizedKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();

    if (privateKey && !privateKey.includes('\n')) {
        console.warn('PEM_STRUCTURE_WARNING: No real line jumps detected in privateKey.');
    }

    if (projectId && clientEmail && privateKey) {
        try {
            initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
            console.log('Firebase Admin: Ignición manual exitosa.');
        } catch (error: any) {
            // RECONSTRUCCIÓN DER: Log de diagnóstico si el parseo falla
            console.error('CRITICAL: Firebase Init Failed. PEM Prefix:', privateKey.substring(0, 50));
            throw error;
        }
    } else {
        console.warn("Manual Firebase Admin config missing. Falling back to default.");
        initializeApp();
    }
}

const db = getFirestore();

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
