import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

/**
 * Endpoint to initiate GSC OAuth2 flow.
 * Redirects the admin to Google's consent screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Audit logs for Vercel troubleshooting
    console.log(process.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID Detectado' : 'GOOGLE_CLIENT_ID Faltante');
    console.log('Redirect URI Target:', 'https://www.oldiebutgoldie.com.ar/api/auth/google/callback');

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
    );

    const scopes = [
        'https://www.googleapis.com/auth/webmasters.readonly'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Critical for getting the refresh_token
        scope: scopes,
        prompt: 'consent' // Forces consent screen to ensure refresh_token is provided every time
    });

    res.redirect(url);
}
