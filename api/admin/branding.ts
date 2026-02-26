export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity, initDriveIdentity } from '../_lib/bunker.js';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Escudo de método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { type, base64, fileName, mimeType } = req.body;

        // Validaciones de transmisión
        if (!['logo', 'favicon'].includes(type)) {
            return res.status(400).json({ error: 'Invalid branding type' });
        }

        if (!base64 || !fileName || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Inicialización de identidades (Bunker)
        const db = await initBunkerIdentity();
        const drive = await initDriveIdentity();

        // 2. ID de Carpeta (Hardcoded para máxima estabilidad)
        const folderId = '1djP4_hmGCbzgH-WMNSrek46VySg-gVs4'.trim();

        // 3. Procesamiento de imagen: Limpieza de prefijo Base64 y creación de Buffer
        const cleanBase64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
        const buffer = Buffer.from(cleanBase64, 'base64');

        // Conversión a Stream para compatibilidad con la API de Drive
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        console.log(`Bunker: Iniciando subida de ${type} a Drive...`);

        // 4. Ejecución de subida a Google Drive
        const driveRes = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
            },
            media: {
                mimeType: mimeType,
                body: stream,
            },
            fields: 'id',
        });

        const fileId = driveRes.data.id;
        if (!fileId) throw new Error('Drive no devolvió un ID de archivo válido.');

        // 5. Apertura de permisos: Hacer el archivo legible para todo el público
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // Construcción de la URL de visualización directa
        const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        console.log(`Bunker: Registrando coordenadas en Firestore para ${type}...`);

        // 6. Persistencia en Firestore (Colección settings/site_config)
        // Se usa merge: true para no sobrescribir el otro asset (si subes logo, mantienes favicon)
        await db.collection('settings').doc('site_config').set({
            [type]: {
                url: publicUrl,
                fileId: fileId,
                updatedAt: new Date().toISOString()
            }
        }, { merge: true });

        // Respuesta exitosa
        return res.status(200).json({
            status: 'SUCCESS',
            url: publicUrl,
            type: type
        });

    } catch (error: any) {
        console.error('Branding API Error:', error.message);

        // Limpieza de mensajes de error para no exponer claves privadas en los logs de cliente
        const safeMessage = (error.message || "")
            .replace(/\{"type": "service_account".*?\}/g, "[SERVICE_ACCOUNT_REDACTED]")
            .replace(/-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----/gs, "[PRIVATE_KEY_REDACTED]");

        return res.status(500).json({
            error: 'Branding operation failed',
            details: safeMessage
        });
    }
}