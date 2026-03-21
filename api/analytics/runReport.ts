import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getSecret, initBunkerIdentity } from '../_lib/bunker';

async function getCredentials() {
    // In Vercel, the credentials are already in process.env.FIREBASE_CONFIG_JSON_STRING
    const rawConfig = process.env.FIREBASE_CONFIG_JSON_STRING;
    if (!rawConfig) throw new Error('FIREBASE_CONFIG_JSON_STRING missing');
    return JSON.parse(rawConfig);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    try {
        const credentials = await getCredentials();
        if (!credentials) {
            throw new Error('Google Credentials not found in Bunker or Environment');
        }

        const auth = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly']
        });

        const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
        const propertyId = process.env.VITE_GA_PROPERTY_ID || '388730990'; // Use fallback if not in env

        const { dateRanges, metrics, dimensions } = req.body;

        const { data: response } = await analyticsData.properties.runReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: dateRanges || [{ startDate: '7daysAgo', endDate: 'today' }],
                dimensions: dimensions || [{ name: 'date' }],
                metrics: metrics || [
                    { name: 'activeUsers' },
                    { name: 'sessions' },
                    { name: 'averageSessionDuration' },
                    { name: 'transactions' }
                ],
            },
        });

        // Format for Recharts (as expected by analyticsService.ts)
        const rows = response.rows || [];
        const formattedData = rows.map(row => {
            const dataPoint: any = {};
            row.dimensionValues?.forEach((dim, idx) => {
                const dimName = response.dimensionHeaders?.[idx]?.name;
                if (dimName) dataPoint[dimName] = dim.value;
            });
            row.metricValues?.forEach((met, idx) => {
                const metName = response.metricHeaders?.[idx]?.name;
                if (metName) dataPoint[metName] = parseFloat(met.value || '0');
            });
            return dataPoint;
        });

        return res.status(200).json(formattedData);

    } catch (error: any) {
        console.error('Analytics API Error:', error);
        return res.status(500).json({
            error: 'Failed to run analytics report',
            details: error.message
        });
    }
}
