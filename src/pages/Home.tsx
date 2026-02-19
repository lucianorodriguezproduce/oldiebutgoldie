import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, MessageSquare, Mail, Layers, Disc, Database, Package, RefreshCw, MapPin, Tag, Plus, ArrowRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { discogsService, type DiscogsSearchResult } from "@/lib/discogs";

type Intent = "COMPRAR" | "VENDER";
type Format = "CD" | "VINILO" | "CASSETTE" | "OTROS";
type Condition = "NUEVO" | "USADO";

export default function Home() {
    const [intent, setIntent] = useState<Intent | null>(null);
    const [query, setQuery] = useState("");
    const [format, setFormat] = useState<Format | null>(null);
    const [condition, setCondition] = useState<Condition | null>(null);
    const [contact, setContact] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [step, setStep] = useState(1); // Internal logic for lead capture step

    // Real-time Search & Selection States
    const [searchResults, setSearchResults] = useState<DiscogsSearchResult[]>([]);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DiscogsSearchResult | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const debouncedQuery = useDebounce(query, 500);

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
    };

    const isContactValid = contact.trim().length > 5 && (contact.includes("@") || /^\+?[\d\s-]{8,}$/.test(contact));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !format || !condition || !intent || !isContactValid) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "intent_leads"), {
                intent,
                query: selectedItem.title,
                discogsId: selectedItem.id,
                format,
                condition,
                contact,
                details: {
                    artist: selectedItem.title.split(' - ')[0],
                    album: selectedItem.title.split(' - ')[1] || selectedItem.title,
                    label: selectedItem.label?.[0] || 'N/A',
                    year: selectedItem.year || 'N/A',
                    country: selectedItem.country || 'N/A'
                },
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            setIsSuccess(true);
        } catch (error) {
            console.error("Error saving lead:", error);
            alert("Error de conexión. Reintente en unos instantes.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8 px-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(223,255,0,0.3)]"
                >
                    <CheckCircle2 className="h-12 w-12 text-black" />
                </motion.div>
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">Protocolo Recibido</h2>
                    <p className="text-gray-500 text-lg md:text-xl max-w-md mx-auto font-medium">
                        Tu intención ha sido registrada en el archivo central. <span className="text-primary">Oldie but Goldie</span> se pondrá en contacto pronto vía {contact.includes("@") ? "Email" : "WhatsApp"}.
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
        <div className="max-w-4xl mx-auto py-8 md:py-20 flex flex-col items-center justify-center min-h-[80vh] px-4">

            <AnimatePresence mode="wait">
                {!selectedItem ? (
                    <motion.div
                        key="step1-search-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full space-y-12 text-center"
                    >
                        {/* Header Minimalista para el buscador */}
                        <header className="space-y-4">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <div className="h-2 w-2 bg-primary animate-pulse rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Sistema de Intención v4.5</span>
                            </div>
                            <h1 className="text-4xl md:text-7xl font-display font-black text-white uppercase tracking-tightest leading-[0.85]">
                                Protocolo <br />
                                <span className="text-primary text-5xl md:text-8xl">Buscador</span>
                            </h1>
                            <p className="text-gray-500 text-xs md:text-sm font-medium max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
                                Identifica la obra en la base de datos central para iniciar el enlace
                            </p>
                        </header>

                        <div className="relative group w-full">
                            <Search className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Artista, Álbum o Referencia..."
                                className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] py-8 md:py-10 pl-16 md:pl-20 pr-8 md:pr-10 text-xl md:text-2xl font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-all focus:bg-black/40 shadow-2xl"
                            />

                            {/* Dropdown Results */}
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
                                                        <div className="flex items-center gap-3 md:gap-4 mt-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                            <span>{result.year || "DATE N/A"}</span>
                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                            <span className="text-primary/60">{result.genre?.[0] || result.type}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-4 md:h-5 w-4 md:w-5 text-gray-800 group-hover:text-primary transition-colors" />
                                                </button>
                                            ))}
                                            {hasMore && (
                                                <button
                                                    type="button"
                                                    onClick={handleLoadMore}
                                                    disabled={isLoadingSearch}
                                                    className="w-full py-5 md:py-6 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50"
                                                >
                                                    {isLoadingSearch ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                                    Ver Más Resultados
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {isLoadingSearch && !searchResults.length && (
                                <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2">
                                    <div className="h-4 md:h-5 w-4 md:w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="step2-disclosure"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12 md:space-y-16 w-full"
                    >
                        {/* Selector de Header dinámico */}
                        <header className="text-center md:text-left space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/60">Fase Operativa</span>
                            <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">Detalle de Obra</h2>
                        </header>

                        {/* Selection Card: Radiohead The Bends Style */}
                        <div className="bg-[#050505] border-2 border-primary rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.12)] group relative w-full transform hover:scale-[1.01] transition-all duration-700">
                            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                                <div className="w-full md:w-2/5 aspect-square relative overflow-hidden">
                                    <motion.img
                                        initial={{ filter: "blur(40px) brightness(0.5)" }}
                                        animate={{ filter: "blur(0px) brightness(0.8)" }}
                                        transition={{ duration: 1.2 }}
                                        src={selectedItem.cover_image || selectedItem.thumb}
                                        alt={selectedItem.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
                                    <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 md:hidden">
                                        <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter leading-tight drop-shadow-2xl">
                                            {selectedItem.title}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex-1 p-8 md:p-12 space-y-10 flex flex-col justify-center bg-gradient-to-br from-[#050505] to-[#080808]">
                                    <div className="hidden md:block space-y-2">
                                        <h3 className="text-4xl lg:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">
                                            {selectedItem.title}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:gap-x-12 md:gap-y-12">
                                        {[
                                            { Icon: Tag, label: "Sello", value: (selectedItem as any).label?.[0] || 'N/A' },
                                            { Icon: MapPin, label: "País", value: (selectedItem as any).country || 'N/A' },
                                            { Icon: Disc, label: "Año", value: selectedItem.year || 'N/A' },
                                            { Icon: Package, label: "Estilo", value: selectedItem.style?.[0] || 'N/A' },
                                        ].map((attr, idx) => (
                                            <motion.div
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 + (0.1 * idx) }}
                                                key={idx}
                                                className="space-y-2"
                                            >
                                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                    <attr.Icon className="h-3 w-3 text-primary/50" /> {attr.label}
                                                </div>
                                                <p className="text-white font-black text-sm md:text-base uppercase tracking-tight">{attr.value}</p>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleResetSelection}
                                        className="self-start flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-primary transition-all border-b border-white/5 hover:border-primary pb-1 group"
                                    >
                                        <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-500" /> Reiniciar Protocolo
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-6 right-6 md:top-10 md:right-10 bg-primary text-black p-2 md:p-3 rounded-full shadow-2xl z-10 scale-90 md:scale-100 animate-pulse">
                                <CheckCircle2 className="h-6 md:h-8 w-6 md:w-8" />
                            </div>
                        </div>

                        {/* ATRIBUTOS: Revelado Progresivo */}
                        <div className="space-y-12 w-full">
                            {/* Formato */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="space-y-6"
                            >
                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 flex items-center gap-2 px-4 italic">
                                    <Layers className="h-3 w-3" /> [ 01 ] Seleccionar Formato
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {(["VINILO", "CD", "CASSETTE", "OTROS"] as Format[]).map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setFormat(f)}
                                            className={`w-full px-6 py-5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-2 ${format === f ? 'bg-primary border-primary text-black shadow-[0_0_30px_rgba(204,255,0,0.2)]' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Estado */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-6"
                            >
                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 flex items-center gap-2 px-4 italic">
                                    <Package className="h-3 w-3" /> [ 02 ] Estado de Conservación
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCondition("NUEVO")}
                                        className={`w-full px-6 md:px-12 py-5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-2 ${condition === "NUEVO" ? 'bg-primary border-primary text-black shadow-[0_0_30px_rgba(204,255,0,0.2)]' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                                    >
                                        Nuevo o Mint (M/NM)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCondition("USADO")}
                                        className={`w-full px-6 md:px-12 py-5 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-2 ${condition === "USADO" ? 'bg-primary border-primary text-black shadow-[0_0_30px_rgba(204,255,0,0.2)]' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                                    >
                                        Usado o Excelente (VG+)
                                    </button>
                                </div>
                            </motion.div>
                        </div>

                        {/* STEP 3: Reveal Action Intent */}
                        <AnimatePresence>
                            {format && condition && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-12 pt-8 w-full"
                                >
                                    <div className="space-y-6">
                                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary flex items-center justify-center gap-2">
                                            <RefreshCw className="h-3 w-3 animate-spin-slow" /> [ 03 ] Enlace de Intención Activo
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <button
                                                type="button"
                                                onClick={() => setIntent("COMPRAR")}
                                                className={`group relative p-10 md:p-14 rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-4 ${intent === "COMPRAR" ? 'bg-primary border-primary text-black shadow-[0_0_50px_rgba(204,255,0,0.3)]' : 'bg-white/5 border-white/5 text-white hover:border-white/20'}`}
                                            >
                                                <Disc className={`h-10 w-10 transition-transform group-hover:rotate-180 ${intent === "COMPRAR" ? 'text-black' : 'text-primary'}`} />
                                                <span className="text-3xl md:text-4xl font-display font-black uppercase tracking-tighter">Quiero Comprar</span>
                                                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Añadir a búsqueda activa</p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIntent("VENDER")}
                                                className={`group relative p-10 md:p-14 rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-4 ${intent === "VENDER" ? 'bg-primary border-primary text-black shadow-[0_0_50px_rgba(204,255,0,0.3)]' : 'bg-white/5 border-white/5 text-white hover:border-white/20'}`}
                                            >
                                                <Database className={`h-10 w-10 transition-transform group-hover:scale-125 ${intent === "VENDER" ? 'text-black' : 'text-primary'}`} />
                                                <span className="text-3xl md:text-4xl font-display font-black uppercase tracking-tighter">Quiero Vender</span>
                                                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Solicitar cotización inmediata</p>
                                            </button>
                                        </div>
                                    </div>

                                    {intent && (
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            type="button"
                                            onClick={() => setStep(2)}
                                            className="w-full bg-[#CCFF00] text-black py-8 md:py-12 rounded-[1.5rem] md:rounded-[3rem] font-black uppercase tracking-[0.4em] text-xs md:text-base hover:scale-[1.01] active:scale-95 transition-all shadow-[0_30px_60px_rgba(204,255,0,0.4)] flex items-center justify-center gap-6 group"
                                        >
                                            Vincular Operación <ArrowRight className="h-6 w-6 group-hover:translate-x-4 transition-transform" />
                                        </motion.button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="pt-20 text-center opacity-30 w-full">
                <p className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.8em]">Oldie but Goldie Terminal // Protocolo Seguro 2026</p>
            </footer>

            {/* MODAL: Lead Capture Flow con Estética Industrial */}
            <AnimatePresence>
                {step === 2 && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 backdrop-blur-3xl bg-black/80">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="bg-[#0A0A0A] border-2 border-primary/40 rounded-[2rem] md:rounded-[3rem] w-full max-w-2xl p-8 md:p-16 space-y-12 relative overflow-hidden shadow-[0_0_120px_rgba(204,255,0,0.15)]"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

                            <div className="space-y-4 text-center">
                                <div className="flex items-center justify-center gap-4 mb-2">
                                    <MessageSquare className="h-8 w-8 text-primary" />
                                    <h3 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">Confirmar Enlace</h3>
                                </div>
                                <p className="text-gray-500 font-medium text-sm md:text-base px-4 leading-relaxed">
                                    Un analista verificará los parámetros técnicos de la obra y se comunicará contigo para finalizar la operación.
                                </p>
                            </div>

                            <div className="space-y-8">
                                <div className="relative group">
                                    <Mail className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 h-5 md:h-6 w-5 md:w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        value={contact}
                                        onChange={(e) => setContact(e.target.value)}
                                        placeholder="WhatsApp o Email..."
                                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl md:rounded-3xl py-6 md:py-8 pl-16 md:pl-20 pr-8 md:pr-10 text-lg md:text-xl font-bold text-white placeholder:text-gray-800 focus:outline-none focus:border-primary transition-all focus:bg-black shadow-inner"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="px-8 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 hover:text-white transition-all order-2 md:order-1"
                                    >
                                        Revisar Archivo
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!isContactValid || isSubmitting}
                                        className="flex-1 bg-primary text-black py-6 md:py-8 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] md:text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(204,255,0,0.2)] disabled:opacity-50 order-1 md:order-2"
                                    >
                                        {isSubmitting ? "Sincronizando..." : "Finalizar Protocolo"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
