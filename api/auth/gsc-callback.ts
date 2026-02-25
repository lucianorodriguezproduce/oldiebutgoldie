import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (Only once)
if (!getApps().length) {
    // Assuming service account info is in environment variables for security
    // If using default credentials in Vercel/GCP, use initializeApp()
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
            credential: cert(serviceAccount)
        });
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

    if (!code) {
        return res.status(400).send('No code provided');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GSC_CLIENT_ID,
        process.env.GSC_CLIENT_SECRET,
        process.env.GSC_REDIRECT_URI
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
            // Already authorized might not return refresh_token unless prompt=consent was used
            res.redirect('/admin/analytics?gsc=partial');
        }
    } catch (error) {
        console.error('GSC OAuth Callback Error:', error);
        res.redirect('/admin/analytics?gsc=error');
    }
}
