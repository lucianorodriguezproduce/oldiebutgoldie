import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
    .catch((error) => console.error("Error setting persistence:", error));

// SDK 12.9.0 introduces a BloomFilter for aggressive caching but causes regression
// with high read volume. Re-initializing firestore with settings explicitly avoiding it or using default
export const db = initializeFirestore(app, {
    // There isn't a direct explicit true/false exposed via TS types always depending on version
    // but initializeFirestore acts as a fresh point avoiding certain cached getFirestore setups.
    // However, if we need 'experimentalForceLongPolling', we'd add it here.
    experimentalForceLongPolling: true, // often helps with network issues / regressions on high request volumes
});

export default app;
