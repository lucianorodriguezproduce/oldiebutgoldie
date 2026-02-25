import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { auth, db } from "./firebase";

export const googleProvider = new GoogleAuthProvider();

/**
 * Google Sign-In via Popup (replaces signInWithRedirect).
 * The user stays on the page, the popup handles auth, and the result
 * is returned directly — no redirect, no localStorage recovery needed.
 */
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
            await syncUserToFirestore(result.user);
        }
        return result.user;
    } catch (error: any) {
        // Handle popup closed by user gracefully
        if (error.code === 'auth/popup-closed-by-user') {
            console.log("User closed the popup, no action needed.");
            return null;
        }
        console.error("Error signing in with Google:", error);
        throw error;
    }
};

/**
 * Unified Authentication: 
 * Attempts to register the user. If they already exist, attempts to sign them in.
 */
export const authenticateUser = async (email: string, pass: string) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        await syncUserToFirestore(user);
        return user;
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            try {
                const result = await signInWithEmailAndPassword(auth, email, pass);
                const user = result.user;
                await syncUserToFirestore(user);
                return user;
            } catch (signInError) {
                console.error("Sign in fallback failed:", signInError);
                throw signInError;
            }
        }
        console.error("Authentication failed:", error);
        throw error;
    }
};

export const syncUserToFirestore = async (user: any) => {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        display_name: user.displayName || user.email?.split('@')[0] || 'User',
        last_login: serverTimestamp(),
        "stats.lastLogin": serverTimestamp(),
        "stats.sessionCount": increment(1)
    }, { merge: true });
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, callback);
};
