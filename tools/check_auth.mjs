import { google } from 'googleapis';
import path from 'path';

async function checkAuth() {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
    const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

    console.log('--- Credential Check ---');
    console.log('Client ID:', GOOGLE_CLIENT_ID ? 'OK' : 'MISSING');
    console.log('Client Secret:', GOOGLE_CLIENT_SECRET ? 'OK' : 'MISSING');
    console.log('Refresh Token:', GOOGLE_REFRESH_TOKEN ? 'OK' : 'MISSING');
    console.log('Redirect URI:', GOOGLE_REDIRECT_URI);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        console.error('Missing credentials in .env');
        return;
    }

    const auth = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    try {
        console.log('\nRequesting Access Token from Google...');
        const { token } = await auth.getAccessToken();
        console.log('Success! Access Token obtained.');

        const drive = google.drive({ version: 'v3', auth });
        console.log('Testing Drive API (listing files)...');
        const res = await drive.files.list({ pageSize: 1 });
        console.log('Drive API works! Found:', res.data.files.length, 'files.');

    } catch (error) {
        console.error('\n--- AUTH ERROR ---');
        console.error('Message:', error.message);
        if (error.response && error.response.data) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('Stack:', error.stack);
    }
}

checkAuth();
