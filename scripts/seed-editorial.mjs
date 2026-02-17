// Seed script using Firebase Admin SDK with Application Default Credentials
// Requires: npm install firebase-admin
// firebase-tools login provides ADC automatically
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Use ADC from firebase login
const app = initializeApp({
    credential: applicationDefault(),
    projectId: "buscador-discogs-11425"
});
const db = getFirestore(app);

async function seed() {
    try {
        const article = {
            title: "The Vinyl Renaissance",
            excerpt: "After decades of digital dominance, the analog warmth of vinyl has recaptured the global consciousness. From Buenos Aires crate-digging scenes to Tokyo's legendary jazz kissaten, the 12-inch format is experiencing its most significant cultural resurgence since the golden era of the 1970s.",
            category: "Culture",
            author: "Stitch Editorial",
            image: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=1200&q=80",
            readTime: "8 min read",
            featured: true,
            status: "published",
            createdAt: FieldValue.serverTimestamp()
        };

        const docRef = await db.collection("editorial").add(article);
        console.log("Sample article seeded with ID:", docRef.id);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding article:", error.message || error);
        process.exit(1);
    }
}

seed();
