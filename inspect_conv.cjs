const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyDHAyVChA_ug0XDOTKZiYJRodoeGf8qNiM",
  authDomain: "buscador-discogs-11425.firebaseapp.com",
  projectId: "buscador-discogs-11425",
  storageBucket: "buscador-discogs-11425.firebasestorage.app",
  messagingSenderId: "344484307950",
  appId: "1:344484307950:web:571e2e4fbe2e4f5b3524ff"
};

async function inspectConversation(tradeId, buyerUsername) {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log(`Inspecting conversation: trades/${tradeId}/conversations/${buyerUsername}`);
    const convRef = doc(db, 'trades', tradeId, 'conversations', buyerUsername);
    
    try {
        const snap = await getDoc(convRef);
        if (!snap.exists()) {
            console.log('Conversation does not exist.');
            return;
        }
        
        console.log('Conversation Data:', JSON.stringify(snap.data(), null, 2));
        
        const messagesRef = collection(db, 'trades', tradeId, 'conversations', buyerUsername, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(5));
        const messagesSnap = await getDocs(q);
        console.log(`Found ${messagesSnap.size} messages.`);
        messagesSnap.forEach(doc => {
            console.log(`- [${doc.id}] ${doc.data().sender_uid}: ${doc.data().text}`);
        });
    } catch (err) {
        console.error("Inspection failed:", err.message);
    }
}

const tradeId = 'ePWMN5HTSUPGuQkNkFMz';
const buyerUsername = '@buyer_test_88';

inspectConversation(tradeId, buyerUsername).catch(console.error);
