import {
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        await signInWithRedirect(auth, googleProvider);
    } catch (error) {
        console.error("Error signing in with Google Redirect:", error);
        throw error;
    }
};

export const handleRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            // For new users, ensure their profile exists in the users collection 
            // before the order is created in Home.tsx
            const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
            await syncUserToFirestore(result.user, isNewUser);
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Error handling redirect result:", error);
        throw error;
    }
};

/**
 * Unified Authentication: 
 * Attempts to register the user. If they already exist, attempts to sign them in.
 */
export const authenticateUser = async (email: string, pass: string) => {
    try {
        // Attempt registration first
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        await syncUserToFirestore(user);
        return user;
    } catch (error: any) {
        // If email already in use, attempt sign in
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

export const syncUserToFirestore = async (user: any, isNewUser: boolean = false) => {
    const userRef = doc(db, "users", user.uid);
    const data: any = {
        uid: user.uid,
        email: user.email,
        display_name: user.displayName || user.email.split('@')[0],
        last_login: serverTimestamp(),
    };

    // If it is strictly a new user, we want to set it rather than merge 
    // to guarantee the document is physically created before moving on.
    if (isNewUser) {
        data.created_at = serverTimestamp();
        await setDoc(userRef, data);
    } else {
        await setDoc(userRef, data, { merge: true });
    }
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, callback);
};
