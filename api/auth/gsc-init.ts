import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

/**
 * Endpoint to initiate GSC OAuth2 flow.
 * Redirects the admin to Google's consent screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GSC_CLIENT_ID,
        process.env.GSC_CLIENT_SECRET,
        process.env.GSC_REDIRECT_URI
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
