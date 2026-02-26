import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function getSecret(name: string) {
    try {
        const [version] = await secretClient.accessSecretVersion({
            name: `projects/344484307950/secrets/${name}/versions/latest`,
        });
        return version.payload?.data?.toString();
    } catch (e) {
        console.warn(`Secret ${name} fetch failed, falling back to env`);
        return process.env[name];
    }
}

/**
 * Endpoint to initiate GSC OAuth2 flow.
 * Redirects the admin to Google's consent screen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientId = await getSecret('GOOGLE_CLIENT_ID');
    const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

    console.log(clientId ? 'GOOGLE_CLIENT_ID Detectado' : 'GOOGLE_CLIENT_ID Faltante');
    console.log('Redirect URI Target:', 'https://www.oldiebutgoldie.com.ar/api/auth/google/callback');

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
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
