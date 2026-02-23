
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
const auth = getAuth(app);

const ORDER_ID = "C5BkqoldsHOHj4ymKd4r";

async function stressTest() {
    console.log(`Authenticating anonymously...`);
    try {
        await signInAnonymously(auth);
        console.log("Authenticated.");
    } catch (err) {
        console.error("Auth failed:", err);
        return;
    }

    console.log(`Starting Stress Test for Order: ${ORDER_ID}`);
    const results = [];
    let currentPrice = 135000;

    for (let i = 1; i <= 10; i++) {
        const adjustedSender = i % 2 === 0 ? "user" : "admin";
        currentPrice += 5000;
        const start = Date.now();

        try {
            await updateDoc(doc(db, "orders", ORDER_ID), {
                negotiationHistory: arrayUnion({
                    price: currentPrice,
                    currency: "ARS",
                    sender: adjustedSender,
                    timestamp: new Date()
                }),
                status: adjustedSender === 'admin' ? "counteroffered" : "pending"
            });
            const end = Date.now();
            console.log(`Step ${i}: Sent as ${adjustedSender} - Price: ${currentPrice} - Latency: ${end - start}ms`);
            results.push(end - start);
        } catch (err) {
            console.error(`Error in step ${i}:`, err);
        }
        // Small delay to avoid hammering too hard if needed, but the user wants "high frequency"
        await new Promise(r => setTimeout(r, 100));
    }

    const totalTime = results.reduce((a, b) => a + b, 0);
    const avgLatency = totalTime / results.length;
    console.log(`--- REPORT ---`);
    console.log(`Total Entries: ${results.length}`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Min Latency: ${Math.min(...results)}ms`);
    console.log(`Max Latency: ${Math.max(...results)}ms`);
}

stressTest().catch(console.error);
