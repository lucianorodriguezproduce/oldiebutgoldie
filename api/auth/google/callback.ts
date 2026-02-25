import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Identity Sync)
if (!getApps().length) {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (creds) {
        try {
            const serviceAccount = creds.startsWith('{') ? JSON.parse(creds) : JSON.parse(Buffer.from(creds, 'base64').toString());
            initializeApp({ credential: cert(serviceAccount) });
        } catch (e) {
            console.error("Firebase Admin Init Error (GSC):", e);
            initializeApp();
        }
    } else {
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
