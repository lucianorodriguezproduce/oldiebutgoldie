// Seed script - temporarily uses a workaround for auth
// Run with: node scripts/seed-editorial.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, Timestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBxhMKqGv-v-IKJ9WPjL0pxdA8lj0I_FQE",
    authDomain: "buscador-discogs-11425.firebaseapp.com",
    projectId: "buscador-discogs-11425",
    storageBucket: "buscador-discogs-11425.firebasestorage.app",
    messagingSenderId: "802365277362",
    appId: "1:802365277362:web:4c7b3ab2f21a04c7f16e39"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
    try {
        // Sign in anonymously to satisfy auth rules
        await signInAnonymously(auth);
        console.log("Authenticated anonymously");

        const article = {
            title: "The Vinyl Renaissance",
            excerpt: "After decades of digital dominance, the analog warmth of vinyl has recaptured the global consciousness. From Buenos Aires crate-digging scenes to Tokyo's legendary jazz kissaten, the 12-inch format is experiencing its most significant cultural resurgence since the golden era of the 1970s.",
            category: "Culture",
            author: "Stitch Editorial",
            image: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=1200&q=80",
            readTime: "8 min read",
            featured: true,
            status: "published",
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, "editorial"), article);
        console.log("Sample article seeded with ID:", docRef.id);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding article:", error);
        process.exit(1);
    }
}

seed();
