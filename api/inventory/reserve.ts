import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initBunkerIdentity } from '../_lib/bunker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { itemId, quantity = 1 } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Missing itemId' });

    try {
        const db = await initBunkerIdentity();

        const result = await db.runTransaction(async (transaction) => {
            const itemRef = db.collection('inventory').doc(itemId);
            const doc = await transaction.get(itemRef);

            if (!doc.exists) {
                throw new Error('404: Not Found');
            }

            const data = doc.data();
            if (!data) throw new Error('404: Data Empty');

            const currentStock = data.logistics?.stock || 0;

            if (currentStock < quantity) {
                throw new Error('409: Conflict - Out of stock');
            }

            const newStock = currentStock - quantity;
            const newStatus = newStock === 0 ? 'sold_out' : (data.logistics?.status || 'active');

            transaction.update(itemRef, {
                'logistics.stock': newStock,
                'logistics.status': newStatus
            });

            return { success: true, newStock, newStatus };
        });

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Inventory Reserve Error:', error);
        const msg = error.message || '';
        const statusCode = msg.startsWith('409') ? 409 : (msg.startsWith('404') ? 404 : 500);
        return res.status(statusCode).json({ error: msg });
    }
}
