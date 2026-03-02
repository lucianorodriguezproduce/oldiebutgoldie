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

const DISCOGS_TOKEN = "cWbHttScejgMgzHxjMXNUcZGRTqjVYhouCGxMMVt";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchDiscogsDetails(id) {
    if (!id || id === 0) return null;
    try {
        const response = await fetch(`https://api.discogs.com/releases/${id}`, {
            headers: {
                'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
                'User-Agent': 'OldieButGoldieAudit/1.0'
            }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error(`Error fetching Discogs ID ${id}:`, e.message);
        return null;
    }
}

async function audit() {
    console.log("Iniciando auditoría enriquecida (Enlace Discogs)...");
    try {
        const q = query(collection(db, "inventory"), limit(100));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const taxonomy = {
            genres: new Set(),
            styles: new Set(),
            decades: new Set(),
            formats: new Set()
        };

        const rarityReport = [];

        for (const item of items) {
            console.log(`Procesando item: ${item.metadata?.title || item.id}...`);
            let discogsId = item.reference?.originalDiscogsId;

            let details = null;
            if (discogsId && discogsId !== 0) {
                details = await fetchDiscogsDetails(discogsId);
                // Wait a bit for rate limiting
                await new Promise(r => setTimeout(r, 100));
            }

            // Use details from Discogs if available, otherwise fallback to local metadata
            const genres = details?.genres || item.metadata?.genres || [];
            const styles = details?.styles || item.metadata?.styles || [];
            const year = details?.year || item.metadata?.year || 0;
            const format = details?.formats?.[0]?.name || item.metadata?.format_description || "Vinyl";

            genres.forEach(g => taxonomy.genres.add(g));
            styles.forEach(s => taxonomy.styles.add(s));
            if (year > 0) {
                const decade = Math.floor(year / 10) * 10;
                taxonomy.decades.add(decade);
            }
            taxonomy.formats.add(format);

            // Smart Tag Logic (Rarity)
            if (details?.community) {
                const have = details.community.have || 0;
                const want = details.community.want || 0;
                let rarity = "común";

                if (have < 50 && want > 200) rarity = "mítica";
                else if (have < 200 && want > 500) rarity = "rara";
                else if (want > 1000) rarity = "alta demanda";

                if (rarity !== "común") {
                    rarityReport.push({
                        title: item.metadata?.title || details.title,
                        rarity,
                        have,
                        want
                    });
                }
            }
        }

        const result = {
            genres: Array.from(taxonomy.genres).sort(),
            styles: Array.from(taxonomy.styles).sort(),
            decades: Array.from(taxonomy.decades).sort(),
            formats: Array.from(taxonomy.formats).sort(),
            rarityHighlights: rarityReport,
            sampleSize: items.length
        };

        fs.writeFileSync("taxonomy_options.json", JSON.stringify(result, null, 2));
        console.log("Auditoría ENRIQUECIDA finalizada. Resultados guardados en taxonomy_options.json");
    } catch (e) {
        console.error("Error en la auditoría:", e);
    }
}

audit().then(() => process.exit(0));
