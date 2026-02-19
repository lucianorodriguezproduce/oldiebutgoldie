import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, Mail, Layers, MapPin, Tag, Plus, ArrowRight } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";
import { authenticateUser, signInWithGoogle, handleRedirectResult } from "@/lib/auth";
import { onAuthStateChanged, type User } from "firebase/auth";

type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";

export default function Home() {
    const [intent, setIntent] = useState<Intent | null>(null);
    const [query, setQuery] = useState("");
    const [format, setFormat] = useState<Format | null>(null);
    const [condition, setCondition] = useState<Condition | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [step, setStep] = useState(1);

    const [searchResults, setSearchResults] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DiscogsSearchResult | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Auth States
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const debouncedQuery = useDebounce(query, 500);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Auto-scroll on step change
    useEffect(() => {
        scrollToTop();
    }, [step, selectedItem]);

    // Recovery Logic & Auth Sync
    useEffect(() => {
        const processBackup = async (currentUser: User) => {
            const backup = localStorage.getItem("oldie_backup");
            if (backup) {
                try {
                    const data = JSON.parse(backup);
                    await performSubmission(currentUser.uid, data);
                    localStorage.removeItem("oldie_backup");
                } catch (e) {
                    console.error("Backup recovery failed:", e);
                }
            }
        };

        const checkRedirect = async () => {
            try {
                const redirectedUser = await handleRedirectResult();
                if (redirectedUser) {
                    setUser(redirectedUser);
                    await processBackup(redirectedUser);
                    setStep(1);
                }
            } catch (err) {
                console.error("Redirect check failed:", err);
            }
        };

        checkRedirect();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                processBackup(currentUser);
            }
        });
        return () => unsubscribe();
    }, []);

    // Effect for real-time Discogs search
    useEffect(() => {
        const performSearch = async () => {
            if (debouncedQuery.trim().length >= 3 && !selectedItem) {
                setIsLoadingSearch(true);
                try {
                    const { results, pagination } = await discogsService.searchReleases(debouncedQuery, 1);
                    setSearchResults(results);
                    setHasMore(pagination.pages > 1);
                    setCurrentPage(1);
                    setShowDropdown(true);
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsLoadingSearch(false);
                }
            } else if (!selectedItem) {
                setSearchResults([]);
                setShowDropdown(false);
                setHasMore(false);
            }
        };
        performSearch();
    }, [debouncedQuery, selectedItem]);

    const handleLoadMore = async () => {
        if (isLoadingSearch || !hasMore) return;
        setIsLoadingSearch(true);
        try {
            const nextPage = currentPage + 1;
            const { results, pagination } = await discogsService.searchReleases(debouncedQuery, nextPage);
            setSearchResults(prev => [...prev, ...results]);
            setCurrentPage(nextPage);
            setHasMore(pagination.page < pagination.pages);
        } catch (error) {
            console.error("Load more error:", error);
        } finally {
            setIsLoadingSearch(false);
        }
    };

    const handleSelectResult = (result: DiscogsSearchResult) => {
        setSelectedItem(result);
        setShowDropdown(false);
    };

    const handleResetSelection = () => {
        setSelectedItem(null);
        setQuery("");
        setFormat(null);
        setCondition(null);
        setIntent(null);
        setSearchResults([]);
        setShowDropdown(false);
        setHasMore(false);
        setStep(1);
    };

    const createBackup = () => {
        if (!selectedItem || !format || !condition || !intent) return null;
        const backup = {
            item: selectedItem,
            format,
            condition,
            intent
        };
        localStorage.setItem("oldie_backup", JSON.stringify(backup));
        return backup;
    };

    const handleGoogleSignIn = async () => {
        createBackup();
        setIsSubmitting(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Google Auth error:", error);
            alert("Error al vincular con Google.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAuthAction = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!email || !password) return;

        createBackup();
        setIsSubmitting(true);
        try {
            const loggedUser = await authenticateUser(email, password);
            if (loggedUser) {
                // Auto-confirm will be handled by onAuthStateChanged if backup exists
                // but we can also trigger it manually here for faster feedback
                const backup = createBackup();
                if (backup) {
                    await performSubmission(loggedUser.uid, backup);
                    localStorage.removeItem("oldie_backup");
                }
            }
        } catch (error) {
            console.error("Manual Auth error:", error);
            alert("Error en autenticación. Verifique sus credenciales.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const performSubmission = async (uid: string, data: any) => {
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "orders"), {
                user_id: uid,
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
            setIsSuccess(true);
        } catch (error) {
            console.error("Firestore error:", error);
            alert("Error al procesar el pedido.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 px-4 font-sans">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(204,255,0,0.3)]"
                >
                    <CheckCircle2 className="h-12 w-12 text-black" />
                </motion.div>
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Pedido Vinculado</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        Tu intención ha sido registrada. <span className="text-primary">Oldie but Goldie</span> procesará tu pedido vinculado a su cuenta.
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all"
                >
                    Nueva Búsqueda
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] px-4 font-sans">
            <AnimatePresence mode="wait">
                {!selectedItem ? (
                    <motion.div
                        key="step1-search-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full space-y-12 text-center"
                    >
                        <header className="space-y-4">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="h-2 w-2 bg-primary animate-pulse rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Sistema de Intención v4.5</span>
                            </div>
                            <h1 className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tightest leading-[0.85]">
                                Protocolo <br />
                                <span className="text-primary text-5xl md:text-8xl">Buscador</span>
                            </h1>
                        </header>

                        <div className="relative group w-full">
                            <Search className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input
                                id="searchQuery"
                                name="searchQuery"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Artista, Álbum o Referencia..."
                                className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-8 md:py-10 pl-16 md:pl-20 pr-8 md:pr-10 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-all focus:bg-black/40 shadow-2xl"
                            />

                            <AnimatePresence>
                                {showDropdown && searchResults.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 right-0 top-full mt-2 bg-[#0A0A0A] border-2 border-white/10 rounded-[1.5rem] md:rounded-3xl overflow-hidden z-50 shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
                                    >
                                        <div className="max-h-[350px] md:max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {searchResults.map((result) => (
                                                <button
                                                    key={`${result.id}-${result.type}`}
                                                    type="button"
                                                    onClick={() => handleSelectResult(result)}
                                                    className="w-full p-5 md:p-6 flex items-center gap-4 md:gap-6 hover:bg-primary/5 transition-colors border-b border-white/5 last:border-0 text-left group"
                                                >
                                                    <div className="w-12 md:w-16 h-12 md:h-16 rounded-lg md:rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                                                        <img src={result.thumb} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-base md:text-lg font-bold text-white truncate group-hover:text-primary transition-colors">{result.title}</h4>
                                                    </div>
                                                    <ChevronRight className="h-4 md:h-5 w-4 md:w-5 text-gray-800 group-hover:text-primary transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="steps-container"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12 md:space-y-16 w-full"
                    >
                        <header className="text-center md:text-left">
                            <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">Detalle de Obra</h2>
                        </header>

                        {/* Selection Card: Context for ALL steps */}
                        <div className="bg-[#050505] border-2 border-primary rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.12)] group relative w-full">
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-2/5 aspect-square relative overflow-hidden">
                                    <img
                                        src={selectedItem.cover_image || selectedItem.thumb}
                                        alt={selectedItem.title}
                                        className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                </div>
                                <div className="flex-1 p-8 md:p-12 space-y-8 flex flex-col justify-center">
                                    <h3 className="text-3xl lg:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">{selectedItem.title}</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Año</p>
                                            <p className="text-white font-bold">{selectedItem.year || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Género</p>
                                            <p className="text-primary font-bold">{selectedItem.genre?.[0] || "N/A"}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleResetSelection} className="text-[10px] font-black uppercase tracking-widest text-gray-700 hover:text-primary transition-colors underline decoration-primary/20">Cambiar Selección</button>
                                </div>
                            </div>
                        </div>

                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-12"
                            >
                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 01 ] Seleccionar Formato </label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {(["VINILO", "CD", "CASSETTE", "OTROS"] as Format[]).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFormat(f)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${format === f ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 italic block px-4"> [ 02 ] Estado </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(["NUEVO", "USADO"] as Condition[]).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCondition(c)}
                                                className={`py-5 rounded-2xl text-xs font-black tracking-widest border-2 transition-all ${condition === c ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500'}`}
                                            >
                                                {c === "NUEVO" ? "NUEVO / MINT" : "USADO / VG+"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {format && condition && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 border-t border-white/5">
                                        <button
                                            onClick={() => { setIntent("COMPRAR"); setStep(2); }}
                                            className="bg-white/10 hover:bg-primary hover:text-black py-8 rounded-[1.5rem] font-black uppercase tracking-tighter text-2xl md:text-3xl transition-all"
                                        >
                                            Comprar
                                        </button>
                                        <button
                                            onClick={() => { setIntent("VENDER"); setStep(2); }}
                                            className="bg-white/10 hover:bg-primary hover:text-black py-8 rounded-[1.5rem] font-black uppercase tracking-tighter text-2xl md:text-3xl transition-all"
                                        >
                                            Vender
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#0A0A0A] border-2 border-primary/40 rounded-[2rem] p-8 md:p-12 space-y-10 shadow-2xl"
                            >
                                <div className="text-center space-y-4">
                                    <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">Vincular Red</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">Protocolo de seguridad para persistir intención</p>
                                </div>

                                <div className="space-y-6">
                                    <button
                                        onClick={handleGoogleSignIn}
                                        className="w-full bg-white text-black py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-4 hover:bg-primary transition-all"
                                    >
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                                        Continuar con Google
                                    </button>

                                    <div className="relative flex items-center gap-4 py-2">
                                        <div className="flex-1 h-px bg-white/10" />
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">O Credenciales Manuales</span>
                                        <div className="flex-1 h-px bg-white/10" />
                                    </div>

                                    <form onSubmit={handleAuthAction} className="space-y-4">
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                                            <input
                                                id="auth_email"
                                                name="email"
                                                type="email"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="Email de Terminal..."
                                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Layers className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                                            <input
                                                id="auth_password"
                                                name="password"
                                                type="password"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="Clave Técnica..."
                                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-6 pl-16 pr-8 text-white focus:border-primary/40 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-primary text-black py-8 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            {isSubmitting ? "CONECTANDO..." : "REGISTRARSE Y VINCULAR"}
                                        </button>
                                    </form>

                                    <button onClick={() => setStep(1)} className="w-full text-[10px] font-black uppercase text-gray-700 hover:text-white transition-colors">Atrás</button>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
