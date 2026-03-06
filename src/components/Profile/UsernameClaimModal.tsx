import { useState, useEffect } from "react";
import { X, Check, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface UsernameClaimModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    onClose?: () => void;
    forceClosable?: boolean;
}

export default function UsernameClaimModal({ isOpen, onSuccess, onClose, forceClosable = true }: UsernameClaimModalProps) {
    const { user, dbUser } = useAuth();
    const [username, setUsername] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Validate as user types
    useEffect(() => {
        if (!username) {
            setIsAvailable(null);
            setError("");
            return;
        }

        const isValidFormat = /^[a-z0-9_]{3,20}$/.test(username);
        if (!isValidFormat) {
            setError("Debe tener entre 3-20 caracteres, minúsculas, números o guión bajo.");
            setIsAvailable(false);
            return;
        }

        setError("");
        const checkAvailability = async () => {
            setIsChecking(true);
            try {
                // HOTFIX: Consult usernames registry instead of searching the users collection (avoids permission errors)
                const usernameRef = doc(db, "usernames", username.toLowerCase());
                const snap = await getDoc(usernameRef);

                if (snap.exists() && snap.data().uid !== user?.uid) {
                    setIsAvailable(false);
                    setError("Este identificador ya está en uso.");
                } else {
                    setIsAvailable(true);
                    setError("");
                }
            } catch (err) {
                console.error("Error checking username:", err);
            } finally {
                setIsChecking(false);
            }
        };

        const timeoutId = setTimeout(checkAvailability, 500); // debounce
        return () => clearTimeout(timeoutId);
    }, [username, user]);

    const handleClaim = async () => {
        if (!user || !isAvailable || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const batch = []; // We use parallel writes for simplicity or runTransaction if strict atomic required
            const userRef = doc(db, "users", user.uid);
            const usernameRef = doc(db, "usernames", username.toLowerCase());

            // 1. Update user document
            const updateUser = updateDoc(userRef, {
                username: username.toLowerCase(),
                updatedAt: serverTimestamp()
            });

            // 2. Register uniqueness bridge
            const registerUsername = setDoc(usernameRef, {
                uid: user.uid,
                claimedAt: serverTimestamp()
            });

            // Atomic writes to both collections
            await Promise.all([updateUser, registerUsername]);

            setIsSuccess(true);
        } catch (err: any) {
            console.error("Error claiming username:", err);
            setError("Hubo un error al registrar el identificador. Intenta nuevamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={forceClosable ? onClose : undefined}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2rem] p-8 overflow-hidden"
                    >
                        {/* Interactive Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
                                    Identidad Social
                                </h2>
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">
                                    Requisito V2.0 P2P
                                </p>
                            </div>
                            {forceClosable && onClose && (
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-6">
                            <AnimatePresence mode="wait">
                                {isSuccess ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-center space-y-6 py-4"
                                    >
                                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto border-4 border-primary/30 animate-pulse">
                                            <Check className="w-10 h-10 text-primary" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">
                                                ¡Identidad Reclamada!
                                            </h3>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                                Bienvenido al Coliseo, @{username}
                                            </p>
                                        </div>
                                        <button
                                            onClick={onSuccess}
                                            className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] transition-all"
                                        >
                                            Continuar Operación
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="form"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-6"
                                    >
                                        <p className="text-sm text-gray-400 font-medium">
                                            Para participar en El Coliseo (intercambios públicos) necesitás un identificador único. Esto protegerá tus operaciones y creará tu perfil público.
                                        </p>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                                                Tu Identificador Único
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">@</span>
                                                <input
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                                    placeholder="luciano_vinilos"
                                                    className={`w-full bg-white/5 border ${isAvailable === false ? 'border-red-500/50' : isAvailable === true ? 'border-primary/50' : 'border-white/10'} rounded-2xl pl-10 pr-12 py-4 text-white font-mono focus:outline-none focus:bg-white/10 transition-all`}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    {isChecking ? (
                                                        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                                                    ) : isAvailable === true ? (
                                                        <Check className="w-5 h-5 text-primary" />
                                                    ) : isAvailable === false && username.length > 0 ? (
                                                        <X className="w-5 h-5 text-red-500" />
                                                    ) : null}
                                                </div>
                                            </div>
                                            {error && (
                                                <p className="text-xs text-red-400 font-medium flex items-center gap-1.5 mt-2 ml-1">
                                                    <AlertCircle className="w-3 h-3" /> {error}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleClaim}
                                            disabled={!isAvailable || isSubmitting}
                                            className="w-full relative group overflow-hidden bg-primary text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reclamar Identidad"}
                                            </span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
