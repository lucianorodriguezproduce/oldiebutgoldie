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

async function audit() {
    console.log("Iniciando auditoría de metadatos...");
    try {
        const q = query(collection(db, "inventory"), limit(100));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => doc.data());

        const taxonomy = {
            genres: new Set(),
            styles: new Set(),
            decades: new Set(),
            formats: new Set()
        };

        items.forEach(item => {
            const m = item.metadata || {};
            if (m.genres) m.genres.forEach(g => taxonomy.genres.add(g));
            if (m.styles) m.styles.forEach(s => taxonomy.styles.add(s));
            if (m.year) {
                const decade = Math.floor(m.year / 10) * 10;
                if (decade > 0) taxonomy.decades.add(decade);
            }
            if (m.format_description) taxonomy.formats.add(m.format_description);
        });

        const result = {
            genres: Array.from(taxonomy.genres).sort(),
            styles: Array.from(taxonomy.styles).sort(),
            decades: Array.from(taxonomy.decades).sort(),
            formats: Array.from(taxonomy.formats).sort(),
            sampleSize: items.length
        };

        fs.writeFileSync("taxonomy_options.json", JSON.stringify(result, null, 2));
        console.log("Auditoría finalizada. Resultados guardados en taxonomy_options.json");
    } catch (e) {
        console.error("Error en la auditoría:", e);
    }
}

audit().then(() => process.exit(0));
