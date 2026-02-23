import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ArrowRight, BookOpen, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLoading } from "@/context/LoadingContext";
import { LazyImage } from "@/components/ui/LazyImage";
import { TEXTS } from "@/constants/texts";

interface Article {
    id: string;
    category: string;
    title: string;
    excerpt: string;
    author: string;
    date?: string;
    readTime: string;
    image: string;
    featured: boolean;
    status: 'draft' | 'published';
}

export default function Editorial() {
    const { showLoading, hideLoading } = useLoading();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [isSubscribing, setIsSubscribing] = useState(false);

    useEffect(() => {
        showLoading(TEXTS.common.syncingEditorial);
        const q = query(
            collection(db, "editorial"),
            where("status", "==", "published"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Article)));
            setLoading(false);
            hideLoading();
        }, (error) => {
            console.error("Editorial listener error:", error);
            setLoading(false);
            hideLoading();
        });
        return unsub;
    }, []);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsSubscribing(true);
        try {
            await addDoc(collection(db, "subscribers"), {
                email,
                subscribedAt: serverTimestamp()
            });
            alert(TEXTS.common.transmissionProtocolEstablished);
            setEmail("");
        } catch (error) {
            console.error("Error subscribing:", error);
            alert(TEXTS.common.connectionError);
        } finally {
            setIsSubscribing(false);
            hideLoading();
        }
    };

    const featured = articles.find(a => a.featured) || articles[0];
    const others = articles.filter(a => a.id !== featured?.id);

    if (loading) {
        return null;
    }

    const handleSeed = async () => {
        if (!confirm("¿Inicializar Protocolo con datos de muestra?")) return;
        try {
            await addDoc(collection(db, "editorial"), {
                title: "El Renacimiento del Vinilo",
                excerpt: "Después de décadas de dominio digital, la calidez analógica del vinilo ha recapturado la conciencia global. Desde las escenas de crate-digging en Buenos Aires hasta los legendarios jazz kissaten de Tokio, el formato de 12 pulgadas está experimentando su mayor resurgimiento cultural.",
                category: "Cultura",
                author: "Oldie but Goldie Editorial",
                image: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=1200&q=80",
                readTime: "8 min de lectura",
                featured: true,
                status: "published",
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error seeding:", error);
            alert("Error en la inicialización: " + error);
        }
    };

    if (articles.length === 0) {
        return (
            <div className="py-20 md:py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center px-4">
                <Search className="h-12 w-12 text-gray-700" />
                <div className="space-y-2">
                    <p className="text-xl font-display font-medium text-gray-500">{TEXTS.common.culturalArchiveEmpty}</p>
                    <p className="text-gray-600 text-sm">{TEXTS.common.nextSyncCycle}</p>
                </div>
                <button
                    onClick={handleSeed}
                    className="opacity-0 hover:opacity-100 transition-opacity bg-red-500/10 text-red-500 px-4 py-2 rounded text-xs uppercase tracking-widest"
                >
                    [ADMIN: INITIALIZE SEED]
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-16 md:space-y-24 py-6 md:py-12">
            {/* Hero Section */}
            {featured && (
                <section>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-[2.5rem] md:rounded-[4rem] overflow-hidden aspect-[4/5] md:aspect-[21/9] min-h-[500px] md:min-h-[600px] border border-white/5 group ring-1 ring-white/10"
                    >
                        <LazyImage
                            src={featured.image}
                            alt={featured.title}
                            className="absolute inset-0 w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-24 pt-24 md:pt-48">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="max-w-3xl space-y-6 md:space-y-8"
                            >
                                <Badge className="bg-primary text-black font-black uppercase tracking-widest px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs shadow-xl shadow-primary/20 self-start">
                                    {featured.featured ? TEXTS.common.featured : TEXTS.common.novelty}
                                </Badge>
                                <h1 className="text-3xl md:text-[6rem] font-display font-black text-white tracking-tightest leading-[1] md:leading-[1.1] uppercase">
                                    {featured.title}
                                </h1>
                                <p className="hidden md:block text-gray-400 text-2xl font-medium leading-relaxed max-w-2xl border-l-4 border-primary pl-8">
                                    {featured.excerpt}
                                </p>
                                <div className="flex flex-wrap items-center gap-6 md:gap-12 pt-4 md:pt-8">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-xl">
                                            <User className="h-4 w-4 md:h-6 md:w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 md:mb-1">{TEXTS.common.analyst}</p>
                                            <span className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">{featured.author}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-xl">
                                            <Clock className="h-4 w-4 md:h-6 md:w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[8px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5 md:mb-1">{TEXTS.common.readingTime}</p>
                                            <span className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">{featured.readTime}</span>
                                        </div>
                                    </div>
                                    <Link to={`/editorial/${featured.id}`} className="w-full md:w-auto mt-4 md:mt-0">
                                        <button className="w-full md:ml-auto bg-white text-black px-8 md:px-12 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black uppercase text-[10px] md:text-xs tracking-[0.2em] hover:bg-primary transition-all flex items-center justify-center gap-4 group/btn">
                                            {TEXTS.common.readArticle} <ArrowRight className="h-4 w-4 md:h-5 md:w-5 group-hover/btn:translate-x-2 transition-transform" />
                                        </button>
                                    </Link>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Articles Grid */}
            <section className="space-y-12 md:space-y-16 px-4 md:px-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-8 md:pb-12 gap-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tightest leading-none uppercase">{TEXTS.common.intelDispatches.split(' ')[0]} <span className="text-primary">{TEXTS.common.intelDispatches.split(' ')[1]}</span></h2>
                        <p className="text-gray-500 mt-2 md:mt-4 text-lg md:text-xl font-medium">{TEXTS.common.monthlyMetadata}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4">
                        {[TEXTS.common.all, TEXTS.common.interviews, TEXTS.common.culture, TEXTS.common.equipment].map((tag) => (
                            <button key={tag} className="px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-white/5 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-16">
                    {others.map((article, i) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="group flex flex-col"
                        >
                            <Link to={`/editorial/${article.id}`} className="block">
                                <div className="aspect-[16/11] rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden mb-8 md:mb-10 relative border border-white/5 ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700 shadow-2xl">
                                    <LazyImage
                                        src={article.image}
                                        alt={article.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute top-6 md:top-8 left-6 md:left-8">
                                        <Badge className="bg-black/80 backdrop-blur-2xl text-white border-white/10 font-bold uppercase tracking-[0.2em] px-4 md:px-5 py-1.5 md:py-2 text-[8px] md:text-[9px] rounded-lg md:rounded-xl shadow-2xl">
                                            {article.category}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-4 md:space-y-6 px-2 md:px-4">
                                    <div className="flex items-center gap-4 md:gap-6 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                                        <span className="flex items-center gap-2"><Clock className="h-3 w-3 md:h-3.5 md:w-3.5" /> {article.readTime}</span>
                                        <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white/10" />
                                        <span>{article.author}</span>
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-bold text-white leading-[1.1] group-hover:text-primary transition-colors duration-500 tracking-tightest">
                                        {article.title}
                                    </h3>
                                    <p className="text-gray-500 font-medium leading-relaxed line-clamp-3 text-base md:text-lg">
                                        {article.excerpt}
                                    </p>
                                    <button className="flex items-center gap-2 md:gap-3 text-primary font-black uppercase text-[10px] md:text-[11px] tracking-[0.3em] pt-6 md:pt-8 group-hover:gap-6 transition-all">
                                        {TEXTS.common.seeNote} <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                                    </button>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Newsletter Section */}
            <section className="pt-12 md:pt-24 px-4 md:px-0">
                <div className="bg-primary rounded-[3rem] md:rounded-[5rem] p-12 md:p-32 flex flex-col md:flex-row items-center justify-between gap-12 md:gap-16 overflow-hidden relative shadow-2xl shadow-primary/20">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[400px] md:w-[800px] h-[400px] md:h-[800px] bg-black/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-white/10 blur-[60px] md:blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10 max-w-2xl space-y-6 md:space-y-8 text-center md:text-left">
                        <Badge className="bg-black text-white font-black uppercase tracking-widest px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[8px] md:text-[10px] inline-block">{TEXTS.common.newsDesk}</Badge>
                        <h2 className="text-5xl md:text-[8rem] font-display font-black text-black tracking-tighter leading-[0.9] md:leading-[0.85] uppercase">
                            {TEXTS.common.joinProtocol.split(' ').map((word, i, arr) => (
                                <span key={i}>
                                    {word}{i < arr.length - 1 && <br />}
                                </span>
                            ))}
                        </h2>
                        <p className="text-black/70 text-lg md:text-2xl font-bold leading-relaxed max-w-lg mx-auto md:mx-0">{TEXTS.common.highFidelityDespatches}</p>
                    </div>

                    <div className="relative z-10 w-full md:w-[500px]">
                        <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
                            <div className="flex flex-col md:flex-row bg-black p-2 md:p-3 rounded-2xl md:rounded-[2.5rem] border border-black/5 shadow-2xl gap-2 md:gap-0">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={TEXTS.common.terminalID}
                                    className="bg-transparent border-0 focus:ring-0 text-white placeholder:text-white/30 font-black uppercase tracking-widest text-xs md:text-sm px-6 md:px-8 py-4 md:py-0 w-full outline-none"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isSubscribing}
                                    className="bg-primary text-black px-8 md:px-12 py-4 md:py-6 rounded-xl md:rounded-[2rem] font-black uppercase tracking-widest text-[10px] md:text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/40 disabled:opacity-50"
                                >
                                    {isSubscribing ? TEXTS.common.linking : TEXTS.common.initialize}
                                </button>
                            </div>
                            <p className="text-[8px] md:text-[10px] font-black text-black/40 uppercase tracking-widest text-center">{TEXTS.common.encryptedVia}</p>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}
// Deployment trigger: Final hero layout verification v1.1
