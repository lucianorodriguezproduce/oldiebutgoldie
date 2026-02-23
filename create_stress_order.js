
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

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

async function createStressOrder() {
    console.log(`Creating Stress Test Order...`);
    const history = [];
    let price = 100000;

    for (let i = 1; i <= 10; i++) {
        const sender = i % 2 === 0 ? "admin" : "user";
        price += 10000;
        history.push({
            price: price,
            currency: "ARS",
            sender: i === 10 ? "user" : sender, // Last one user
            timestamp: new Date(Date.now() - (11 - i) * 60000) // 1 min apart
        });
    }

    const payload = {
        user_id: "StressTestUser",
        user_name: "Usuario de Pruebas",
        order_number: "#STRESS-LOTE",
        type: "buy",
        status: "pending",
        totalPrice: price,
        currency: "ARS",
        negotiationHistory: history,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        items: [
            {
                title: "Stress Test Vinyl",
                artist: "The Loaders",
                format: "VINILO",
                condition: "EXCELLENT",
                cover_image: "https://raw.githubusercontent.com/lucianorodriguezproduce/buscadordiscogs2/refs/heads/main/public/obg.png"
            }
        ]
    };

    try {
        const docRef = await addDoc(collection(db, "orders"), payload);
        console.log(`STRESS_ORDER_CREATED: ${docRef.id}`);
    } catch (err) {
        console.error("Failed to create stress order:", err);
    }
}

createStressOrder().catch(console.error);
