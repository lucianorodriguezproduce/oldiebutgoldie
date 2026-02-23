import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://oldie-but-goldie.vercel.app';
// The project ID for oldie-but-goldie / vinilos-app
// If you use a .env file locally for the script, it should load VITE_FIREBASE_PROJECT_ID
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'vinilos-app-e1d2c';

async function fetchEditorialSlugs() {
    try {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/editorial`);

        if (!response.ok) {
            console.error('Failed to fetch from Firestore REST API:', response.statusText);
            return [];
        }

        const data = await response.json();
        const slugs: string[] = [];

        if (data && data.documents) {
            data.documents.forEach((doc: any) => {
                if (doc.fields && doc.fields.slug && doc.fields.slug.stringValue) {
                    slugs.push(doc.fields.slug.stringValue);
                }
            });
        }

        return slugs;
    } catch (error) {
        console.error("Error fetching slugs:", error);
        return [];
    }
}

async function generateSitemap() {
    const staticRoutes = [
        '/',
        '/actividad',
        '/editorial'
    ];

    const slugs = await fetchEditorialSlugs();
    const dynamicRoutes = slugs.map(slug => `/editorial/${slug}`);

    const allRoutes = [...staticRoutes, ...dynamicRoutes];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `    <url>
        <loc>${BASE_URL}${route}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>${route === '/' || route === '/actividad' ? 'daily' : 'weekly'}</changefreq>
        <priority>${route === '/' ? '1.0' : route === '/actividad' ? '0.9' : '0.8'}</priority>
    </url>`).join('\n')}
</urlset>`;

    const publicPath = path.resolve(__dirname, '..', 'public');
    if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
    }

    fs.writeFileSync(path.join(publicPath, 'sitemap.xml'), sitemapContent);
}

generateSitemap().catch();
