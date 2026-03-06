const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Manual env parsing to avoid dependency issues
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            env[match[1]] = value;
        }
    });
    return env;
}

const env = loadEnv(path.resolve(__dirname, '../.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Error: Missing Firebase credentials in .env.local');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
    }),
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next process tick, to avoid
    // stack overflows which can happen with overflow queries.
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

/**
 * Deletes a collection and all its subcollections recursively
 */
async function deleteCollectionRecursive(collectionPath) {
    console.log(`🧹 Cleaning collection: ${collectionPath}...`);
    const collectionRef = db.collection(collectionPath);
    const snaps = await collectionRef.listDocuments();

    for (const docRef of snaps) {
        // Delete subcollections first
        const subcollections = await docRef.listCollections();
        for (const sub of subcollections) {
            await deleteCollectionRecursive(`${collectionPath}/${docRef.id}/${sub.id}`);
        }
        // Delete the document itself
        await docRef.delete();
    }
    console.log(`✅ ${collectionPath} cleared.`);
}

async function runTabulaRasa() {
    console.log('🚀 Starting Operación "Tabla Rasa"...');

    const collectionsToClear = [
        'trades',
        'purchase_requests',
        'user_assets',
        'connections',
        'leads',
        'interactions',
        'missed_searches',
        'notifications'
    ];

    try {
        for (const collection of collectionsToClear) {
            // Using listDocuments for better recursive cleanup of subcollections (like proposals)
            await deleteCollectionRecursive(collection);
        }

        console.log('📦 Recalibrating Inventory...');
        const invSnap = await db.collection('inventory').get();
        const batch = db.batch();
        invSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                'logistics.stock': 1,
                'logistics.status': 'active'
            });
        });
        await batch.commit();
        console.log(`✅ ${invSnap.size} items recalibrated.`);

        console.log('\n✨ OPERACIÓN FINALIZADA CON ÉXITO');
        console.log('Identidades (@usernames) y Catálogo preservados (Stock reset a 1).');
        console.log('El motor está listo para el reinicio total.');

    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL SANEAMIENTO:', error);
    }
}

runTabulaRasa();
