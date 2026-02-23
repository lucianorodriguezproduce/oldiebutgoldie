
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function findOrder() {
    console.log("Searching for orders...");
    const q = collection(db, "orders");
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const labelStr = JSON.stringify(data);
        if (labelStr.includes("LOTE-14EJI") || labelStr.includes("LOTE-FAO0X")) {
            console.log(`FOUND_ORDER: ${doc.id}`);
            console.log(`DATA: ${JSON.stringify(data)}`);
        }
    });
}

findOrder().catch(console.error);
