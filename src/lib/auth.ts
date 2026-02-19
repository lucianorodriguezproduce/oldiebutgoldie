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
            await syncUserToFirestore(result.user);
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Error handling redirect result:", error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, pass: string) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        await syncUserToFirestore(user);
        return user;
    } catch (error) {
        console.error("Error signing in with Email:", error);
        throw error;
    }
};

export const signUpWithEmail = async (email: string, pass: string) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        const user = result.user;
        await syncUserToFirestore(user);
        return user;
    } catch (error) {
        console.error("Error signing up with Email:", error);
        throw error;
    }
};

export const syncUserToFirestore = async (user: any) => {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        display_name: user.displayName || user.email.split('@')[0],
        last_login: serverTimestamp(),
    }, { merge: true });
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, callback);
};
