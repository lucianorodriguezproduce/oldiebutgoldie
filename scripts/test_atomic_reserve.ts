import fetch from 'node-fetch';

const API_URL = 'https://oldiebutgoldie.com.ar/api/inventory/reserve'; // Adjust if local or different
// Since I can't easily run it against the real production from here without Auth if it's protected,
// I'll simulate a test case or provide a script the user can run.

async function testAtomicReserve(itemId: string) {
    console.log(`Testing atomic reserve for item: ${itemId}`);

    const results = await Promise.all([
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity: 1 })
        }),
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity: 1 })
        })
    ]);

    const statuses = await Promise.all(results.map(r => r.status));
    const bodies = await Promise.all(results.map(r => r.json()));

    console.log('Results:', statuses);
    console.log('Bodies:', bodies);

    const successes = statuses.filter(s => s === 200).length;
    const conflicts = statuses.filter(s => s === 409).length;

    if (successes === 1 && conflicts === 1) {
        console.log('✅ TEST PASSED: Atomic transaction prevents over-selling.');
    } else {
        console.log('❌ TEST FAILED: Response pattern unexpected.', { successes, conflicts });
    }
}

// Example usage (Requires a valid item with stock 1)
// testAtomicReserve('test-uuid-123');
