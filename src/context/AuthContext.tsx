import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    isAdmin: boolean;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMasterAdmin, setIsMasterAdmin] = useState(() => {
        return localStorage.getItem("admin_session") === "true";
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);

            if (currentUser?.email === "admin@discography.ai") {
                localStorage.setItem("admin_session", "true");
                setIsMasterAdmin(true);
            } else if (!currentUser) {
                localStorage.removeItem("admin_session");
                setIsMasterAdmin(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        localStorage.removeItem("admin_session");
        setIsMasterAdmin(false);
        await firebaseSignOut(auth);
    };

    const isAdmin = !!user && (isMasterAdmin || user.email === "admin@discography.ai");

    return (
        <AuthContext.Provider value={{ user, isAdmin, loading, logout }}>
            {!loading && children}
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
