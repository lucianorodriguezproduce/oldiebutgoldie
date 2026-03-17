import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { DbUser } from "@/types/user";
import { isAdminEmail, ADMIN_UIDS } from "@/constants/admin";

interface AuthContextType {
    user: User | null;
    dbUser: DbUser | null;
    isAdmin: boolean;
    isEmailVerified: boolean;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMasterAdmin, setIsMasterAdmin] = useState(() => {
        return localStorage.getItem("admin_session") === "true";
    });

    useEffect(() => {
        let unsubscribeDbUser: () => void;

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Listen to the user's Firestore document
                unsubscribeDbUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        setDbUser({ id: docSnap.id, ...docSnap.data() } as unknown as DbUser);
                    } else {
                        setDbUser(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("AuthContext dbUser listener error:", err);
                    setLoading(false);
                });
            } else {
                setDbUser(null);
                setLoading(false);
            }

            if (isAdminEmail(currentUser?.email)) {
                localStorage.setItem("admin_session", "true");
                setIsMasterAdmin(true);
            } else if (!currentUser) {
                localStorage.removeItem("admin_session");
                setIsMasterAdmin(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDbUser) unsubscribeDbUser();
        };
    }, []);

    const logout = React.useCallback(async () => {
        localStorage.removeItem("admin_session");
        setIsMasterAdmin(false);
        await firebaseSignOut(auth);
    }, []);

    const isAdmin = !!user && (isMasterAdmin || isAdminEmail(user.email) || ADMIN_UIDS.includes(user.uid));

    const isEmailVerified = !!user && user.emailVerified;

    const value = React.useMemo(() => ({
        user,
        dbUser,
        isAdmin,
        isEmailVerified,
        loading,
        logout
    }), [user, dbUser, isAdmin, isEmailVerified, loading, logout]);

    return (
        <AuthContext.Provider value={value}>
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
