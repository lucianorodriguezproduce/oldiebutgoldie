import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, limit, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
    apiKey: "AIzaSyDHAyVChA_ug0XDOTKZiYJRodoeGf8qNiM",
    authDomain: "buscador-discogs-11425.firebaseapp.com",
    projectId: "buscador-discogs-11425",
    storageBucket: "buscador-discogs-11425.firebasestorage.app",
    messagingSenderId: "344484307950",
    appId: "1:344484307950:web:571e2e4fbe2e4f5b3524ff"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
    const q = query(collection(db, "inventory"), limit(5));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    fs.writeFileSync("inspect_sample.json", JSON.stringify(items, null, 2));
}

inspect().then(() => process.exit(0));
