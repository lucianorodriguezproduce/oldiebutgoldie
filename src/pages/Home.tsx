import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, CheckCircle2, MessageSquare, Mail, Layers, Disc, Database, Package, RefreshCw, MapPin, Tag, Plus } from "lucide-react";
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
    const [step, setStep] = useState(1);

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
            // Only search if no item is selected
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
        setQuery(result.title);
        setShowDropdown(false);
    };

    const handleResetSelection = () => {
        setSelectedItem(null);
        setQuery("");
        setSearchResults([]);
        setShowDropdown(false);
        setHasMore(false);
    };

    const isStep1Valid = intent && selectedItem && format && condition;
    const isContactValid = contact.trim().length > 5 && (contact.includes("@") || /^\+?[\d\s-]{8,}$/.test(contact));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isStep1Valid || !isContactValid) return;

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
        <div className="max-w-4xl mx-auto py-12 md:py-20 space-y-16 px-4">
            {/* Header Industrial */}
            <header className="space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                    <div className="h-2 w-2 bg-primary animate-pulse rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Sistema de Intención v3.5</span>
                </div>
                <h1 className="text-5xl md:text-8xl font-display font-black text-white uppercase tracking-tightest leading-[0.85]">
                    Encuentra <br />
                    <span className="text-primary">Tu Sonido</span>
                </h1>
                <p className="text-gray-500 text-lg md:text-xl font-medium max-w-xl">
                    Interfaz de enlace directo para coleccionistas. Define tu intención y nosotros rastreamos la pieza.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-16">
                {/* Paso 1: Configuración de Intención */}
                <div className={`space-y-12 transition-opacity duration-500 ${step === 2 ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>

                    {/* Selector Binario */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setIntent("COMPRAR")}
                            className={`group relative p-8 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-4 ${intent === "COMPRAR" ? 'bg-primary border-primary' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                        >
                            <Disc className={`h-8 w-8 transition-transform group-hover:rotate-45 ${intent === "COMPRAR" ? 'text-black' : 'text-primary'}`} />
                            <span className={`text-2xl font-black uppercase tracking-tighter ${intent === "COMPRAR" ? 'text-black' : 'text-white'}`}>Quiero Comprar</span>
                            {intent === "COMPRAR" && <div className="absolute top-4 right-4 bg-black text-white p-1 rounded-full"><CheckCircle2 className="h-4 w-4" /></div>}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIntent("VENDER")}
                            className={`group relative p-8 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-4 ${intent === "VENDER" ? 'bg-primary border-primary' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                        >
                            <Database className={`h-8 w-8 transition-transform group-hover:scale-110 ${intent === "VENDER" ? 'text-black' : 'text-primary'}`} />
                            <span className={`text-2xl font-black uppercase tracking-tighter ${intent === "VENDER" ? 'text-black' : 'text-white'}`}>Quiero Vender</span>
                            {intent === "VENDER" && <div className="absolute top-4 right-4 bg-black text-white p-1 rounded-full"><CheckCircle2 className="h-4 w-4" /></div>}
                        </button>
                    </div>

                    {/* Buscador o Tarjeta de Selección */}
                    <AnimatePresence mode="wait">
                        {!selectedItem ? (
                            <motion.div
                                key="search"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="relative group"
                            >
                                <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Artista, Álbum o Referencia..."
                                    className="w-full bg-white/5 border-2 border-white/5 hover:border-white/10 rounded-[2.5rem] py-10 pl-20 pr-10 text-2xl font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-all focus:bg-black/40"
                                />

                                {/* Dropdown de Resultados */}
                                <AnimatePresence>
                                    {showDropdown && searchResults.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute left-0 right-0 top-full mt-2 bg-[#0A0A0A] border-2 border-white/10 rounded-3xl overflow-hidden z-50 shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
                                        >
                                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                                {searchResults.map((result) => (
                                                    <button
                                                        key={`${result.id}-${result.type}`}
                                                        type="button"
                                                        onClick={() => handleSelectResult(result)}
                                                        className="w-full p-6 flex items-center gap-6 hover:bg-primary/5 transition-colors border-b border-white/5 last:border-0 text-left group"
                                                    >
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                                                            <img src={result.thumb} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-lg font-bold text-white truncate group-hover:text-primary transition-colors">{result.title}</h4>
                                                            <div className="flex items-center gap-4 mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                                <span>{result.year || "YEAR N/A"}</span>
                                                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                                                <span className="text-primary/60">{result.genre?.[0] || result.type}</span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-5 w-5 text-gray-800 group-hover:text-primary transition-colors" />
                                                    </button>
                                                ))}
                                                {hasMore && (
                                                    <button
                                                        type="button"
                                                        onClick={handleLoadMore}
                                                        disabled={isLoadingSearch}
                                                        className="w-full py-6 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.3em] text-primary bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50"
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
                                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="selection-card"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-[#050505] border-2 border-primary rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(204,255,0,0.1)] group relative"
                            >
                                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                                    <div className="md:w-1/3 aspect-square relative">
                                        <img src={selectedItem.cover_image || selectedItem.thumb} alt={selectedItem.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
                                    </div>
                                    <div className="flex-1 p-8 md:p-12 space-y-8 flex flex-col justify-center">
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/60">Edición Seleccionada</span>
                                            <h3 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter leading-none">
                                                {selectedItem.title}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                                    <Tag className="h-3 w-3" /> Sello
                                                </div>
                                                <p className="text-white font-bold">{selectedItem.label?.[0] || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                                    <MapPin className="h-3 w-3" /> País
                                                </div>
                                                <p className="text-white font-bold">{selectedItem.country || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                                    <Disc className="h-3 w-3" /> Año
                                                </div>
                                                <p className="text-white font-bold">{selectedItem.year || 'N/A'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                                    <Package className="h-3 w-3" /> Formato
                                                </div>
                                                <p className="text-white font-bold">{selectedItem.genre?.[0] || 'N/A'}</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleResetSelection}
                                            className="self-start flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-primary transition-colors border-b border-white/5 hover:border-primary pb-1"
                                        >
                                            <RefreshCw className="h-3 w-3" /> Cambiar Selección
                                        </button>
                                    </div>
                                </div>
                                <div className="absolute top-6 right-6 bg-primary text-black p-2 rounded-full shadow-xl">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Atributos: Formato */}
                    <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2 px-4">
                            <Layers className="h-3 w-3" /> Confirmar Formato Buscando
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {(["VINILO", "CD", "CASSETTE", "OTROS"] as Format[]).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFormat(f)}
                                    className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${format === f ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Atributos: Estado */}
                    <div className="space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2 px-4">
                            <Package className="h-3 w-3" /> Condición Requerida
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => setCondition("NUEVO")}
                                className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${condition === "NUEVO" ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                            >
                                Nuevo / Sellado
                            </button>
                            <button
                                type="button"
                                onClick={() => setCondition("USADO")}
                                className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 ${condition === "USADO" ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:border-white/10'}`}
                            >
                                Usado / Excelente
                            </button>
                        </div>
                    </div>

                    {step === 1 && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!isStep1Valid}
                            className="w-full bg-white text-black py-8 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm hover:bg-primary transition-all flex items-center justify-center gap-4 disabled:opacity-20 disabled:grayscale group"
                        >
                            Vincular Operación <ChevronRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                        </motion.button>
                    )}
                </div>

                {/* Paso 2: Lead Capture */}
                <AnimatePresence>
                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-primary/5 border border-primary/20 rounded-[3rem] p-12 space-y-10"
                        >
                            <div className="space-y-4">
                                <h3 className="text-3xl font-display font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                    <MessageSquare className="h-8 w-8 text-primary" /> Datos de Contacto
                                </h3>
                                <p className="text-gray-500 font-medium">
                                    Un analista de <span className="text-white">Oldie but Goldie</span> verificará los parámetros y se comunicará contigo.
                                </p>
                            </div>

                            <div className="relative group">
                                <Mail className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    placeholder="WhatsApp o Email..."
                                    className="w-full bg-black/40 border-2 border-white/10 rounded-3xl py-8 pl-20 pr-10 text-xl font-bold text-white placeholder:text-gray-800 focus:outline-none focus:border-primary transition-all"
                                    required
                                />
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="px-8 py-6 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all order-2 md:order-1"
                                >
                                    Editar Parámetros
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isContactValid || isSubmitting}
                                    className="flex-1 bg-primary text-black py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(223,255,0,0.15)] disabled:opacity-50 order-1 md:order-2"
                                >
                                    {isSubmitting ? "Sincronizando..." : intent === "COMPRAR" ? "Añadir a mi Colección" : "Solicitar Oferta"}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </form>

            <footer className="pt-20 text-center border-t border-white/5">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em]">Protocolo Oldie but Goldie • Terminal Segura</p>
            </footer>
        </div>
    );
}
