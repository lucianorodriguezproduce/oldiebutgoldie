import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { handleRedirectResult, syncUserToFirestore } from "@/lib/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    loading: boolean;
    logout: () => Promise<void>;
    orderRecovered: boolean;
    isRecoveringBackup: boolean;
    clearOrderRecovered: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [orderRecovered, setOrderRecovered] = useState(false);
    const [isRecoveringBackup, setIsRecoveringBackup] = useState(false);
    const [isMasterAdmin, setIsMasterAdmin] = useState(() => {
        return localStorage.getItem("admin_session") === "true";
    });

    const clearOrderRecovered = () => setOrderRecovered(false);

    // The Global Rescue: Save order from localStorage when user is confirmed
    const performGlobalRescue = async (currentUser: User) => {
        const backup = localStorage.getItem("oldie_backup");
        if (!backup) return;

        setIsRecoveringBackup(true);
        window.scrollTo({ top: 0, behavior: "smooth" });

        try {
            const data = JSON.parse(backup);

            // Ensure user profile exists in Firestore before saving the order
            await syncUserToFirestore(currentUser);

            await addDoc(collection(db, "orders"), {
                user_id: currentUser.uid,
                item_id: data.item.id,
                details: {
                    format: data.format,
                    condition: data.condition,
                    intent: data.intent,
                    artist: data.item.title.split(' - ')[0],
                    album: data.item.title.split(' - ')[1] || data.item.title,
                },
                timestamp: serverTimestamp(),
                status: 'pending'
            });

            localStorage.removeItem("oldie_backup");
            setOrderRecovered(true);
        } catch (error) {
            console.error("Global rescue failed:", error);
            // On failure, keep oldie_backup in localStorage for manual retry
        } finally {
            setIsRecoveringBackup(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        // 1. Check for Google redirect result FIRST (this resolves the redirect user)
        handleRedirectResult()
            .then((redirectedUser) => {
                if (redirectedUser && isMounted) {
                    setUser(redirectedUser);
                    setLoading(false);
                    performGlobalRescue(redirectedUser);
                }
            })
            .catch(err => console.error("Redirect check failed:", err));

        // 2. The main auth state listener (catches ALL auth events)
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!isMounted) return;
            setUser(currentUser);
            setLoading(false);

            if (currentUser?.email === "admin@discography.ai") {
                localStorage.setItem("admin_session", "true");
                setIsMasterAdmin(true);
            } else if (!currentUser) {
                localStorage.removeItem("admin_session");
                setIsMasterAdmin(false);
            }

            // If a user just logged in (manual or redirect) and there's a backup, rescue it
            if (currentUser) {
                performGlobalRescue(currentUser);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const logout = async () => {
        localStorage.removeItem("admin_session");
        setIsMasterAdmin(false);
        await firebaseSignOut(auth);
    };

    const isAdmin = !!user && (isMasterAdmin || user.email === "admin@discography.ai");

    return (
        <AuthContext.Provider value={{ user, isAdmin, loading, logout, orderRecovered, isRecoveringBackup, clearOrderRecovered }}>
            {!loading && children}
            {isRecoveringBackup && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: '#050505', textAlign: 'center', padding: '1rem'
                }}>
                    <div style={{
                        width: 48, height: 48,
                        border: '4px solid rgba(255,255,255,0.1)',
                        borderTopColor: '#CCFF00',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: 32
                    }} />
                    <h2 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                        Protegiendo tu selección...
                    </h2>
                    <p style={{ color: '#6b7280', marginTop: 8 }}>
                        Sincronizando tu pedido con Oldie but Goldie. No cierres esta ventana.
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
