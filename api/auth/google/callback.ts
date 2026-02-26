import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { initBunkerIdentity, getSecret } from '../../_lib/bunker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('No code provided');
        }

        const clientId = await getSecret('GOOGLE_CLIENT_ID');
        const clientSecret = await getSecret('GOOGLE_CLIENT_SECRET');

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'https://www.oldiebutgoldie.com.ar/api/auth/google/callback'
        );
        // ... existing callback logic ...
        const { tokens } = await oauth2Client.getToken(code as string);

        if (tokens.refresh_token) {
            await db.collection('system_config').doc('gsc_auth').set({
                refresh_token: tokens.refresh_token,
                last_updated: new Date().toISOString(),
                status: 'active'
            }, { merge: true });

            res.redirect('/admin/analytics?gsc=success');
        } else {
            res.redirect('/admin/analytics?gsc=partial');
        }
    } catch (error: any) {
        console.error('GSC OAuth Callback Error:', error);
        res.redirect('/admin/analytics?gsc=error');
    }
}
