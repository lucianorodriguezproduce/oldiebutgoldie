import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Mock credentials for secret client if needed, or just let it use ADC/environment
const secretClient = new SecretManagerServiceClient();

async function probe() {
    try {
        const [version] = await secretClient.accessSecretVersion({
            name: 'projects/344484307950/secrets/FIREBASE_ADMIN_SDK_JSON/versions/latest',
        });
        const payload = version.payload?.data?.toString();
        if (!payload) throw new Error('Empty payload');
        const credentials = JSON.parse(payload);
        console.log('--- DIAGNOSTIC START ---');
        console.log('SERVICE_ACCOUNT_EMAIL:', credentials.client_email);
        console.log('PROJECT_ID:', credentials.project_id);
        console.log('--- DIAGNOSTIC END ---');
    } catch (e) {
        console.error('Probe failed:', e.message);
    }
}

probe();
