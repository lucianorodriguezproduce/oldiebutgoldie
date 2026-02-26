import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from './_lib/bunker.js';

// Función táctica para evitar que fechas mal formateadas rompan el sistema
function safeDate(field: any): string {
    if (!field) return new Date().toISOString();
    if (typeof field.toDate === 'function') return field.toDate().toISOString();
    try {
        const parsed = new Date(field);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
    } catch (e) { }
    return new Date().toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const db = await initBunkerIdentity();

        <urlset xmlns="[suspicious link removed]" >
            ${ urls }
        </urlset>`;

    }