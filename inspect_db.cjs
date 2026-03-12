const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, getDoc, query, limit, where, or, orderBy } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDHAyVChA_ug0XDOTKZiYJRodoeGf8qNiM",
  authDomain: "buscador-discogs-11425.firebaseapp.com",
  projectId: "buscador-discogs-11425",
  storageBucket: "buscador-discogs-11425.firebasestorage.app",
  messagingSenderId: "344484307950",
  appId: "1:344484307950:web:571e2e4fbe2e4f5b3524ff"
};

async function inspect() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("--- Testing OR Query WITHOUT orderBy ---");
  try {
    const dummyUid = "3JQ7C5tNi6RbA6q7YTHRTBaY8Vz2";
    const q = query(
        collection(db, "trades"),
        or(
            where("isPublicOrder", "==", true),
            where("participants.senderId", "==", dummyUid),
            where("participants.receiverId", "==", dummyUid)
        ),
        limit(20)
    );
    const snap = await getDocs(q);
    console.log(`Success! Found ${snap.size} OR trades.`);
  } catch (err) {
    console.error("OR Query Failed:", err.message);
  }
}

inspect().catch(console.error);
