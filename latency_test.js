
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDHAyVChA_ug0XDOTKZiYJRodoeGf8qNiM",
    authDomain: "buscador-discogs-11425.firebaseapp.com",
    projectId: "buscador-discogs-11425",
    storageBucket: "buscador-discogs-11425.firebasestorage.app",
    messagingSenderId: "344484307950",
    appId: "1:344484307950:web:571e2e4fbe2e4f5b3524ff",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function latencyTest() {
    console.log(`Starting Latency Test on Public Collection: interactions`);
    const results = [];

    for (let i = 1; i <= 10; i++) {
        const start = Date.now();
        try {
            await addDoc(collection(db, "interactions"), {
                timestamp: new Date(),
                test: "stress-test",
                iteration: i,
                userAgent: "Antigravity-Stress-Test"
            });
            const end = Date.now();
            console.log(`Step ${i}: Doc Created - Latency: ${end - start}ms`);
            results.push(end - start);
        } catch (err) {
            console.error(`Error in step ${i}:`, err);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    const totalTime = results.reduce((a, b) => a + b, 0);
    const avgLatency = totalTime / results.length;
    console.log(`--- LATENCY REPORT ---`);
    console.log(`Total Ops: ${results.length}`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Min Latency: ${Math.min(...results)}ms`);
    console.log(`Max Latency: ${Math.max(...results)}ms`);
}

latencyTest().catch(console.error);
