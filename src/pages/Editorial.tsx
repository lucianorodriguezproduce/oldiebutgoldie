import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ArrowRight, BookOpen, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useState, useEffect } from "react";

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
    createdAt?: any;
}

export default function Editorial() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [isSubscribing, setIsSubscribing] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, "editorial"),
            where("status", "==", "published")
        );
        const unsub = onSnapshot(q, (snap) => {
            const fetchedArticles = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
            // Client-side sort to avoid composite index requirement
            fetchedArticles.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
            });
            setArticles(fetchedArticles);
            setLoading(false);
        }, (error) => {
            console.error("Editorial listener error:", error);
            setLoading(false);
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
            alert("Transmission protocol established. Welcome to the Sonic Protocol.");
            setEmail("");
        } catch (error) {
            console.error("Error subscribing:", error);
            alert("Connection error. Re-initialise.");
        } finally {
            setIsSubscribing(false);
        }
    };

    const featured = articles.find(a => a.featured) || articles[0];
    const others = articles.filter(a => a.id !== featured?.id);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
                <BookOpen className="h-12 w-12 text-primary animate-pulse" />
                <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Synchronising Editorial Grid...</p>
            </div>
        );
    }

    const handleSeed = async () => {
        if (!confirm("Initialize Protocol with sample data?")) return;
        try {
            await addDoc(collection(db, "editorial"), {
                title: "The Vinyl Renaissance",
                excerpt: "After decades of digital dominance, the analog warmth of vinyl has recaptured the global consciousness. From Buenos Aires crate-digging scenes to Tokyo's legendary jazz kissaten, the 12-inch format is experiencing its most significant cultural resurgence since the golden era of the 1970s.",
                category: "Culture",
                author: "Stitch Editorial",
                image: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=1200&q=80",
                readTime: "8 min read",
                featured: true,
                status: "published",
                createdAt: serverTimestamp()
            });
            // Force reload or let snapshot handle it
        } catch (error) {
            console.error("Error seeding:", error);
            alert("Protocol initialization failed: " + error);
        }
    };

    if (articles.length === 0) {
        return (
            <div className="py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                <Search className="h-12 w-12 text-gray-700" />
                <div className="space-y-2">
                    <p className="text-xl font-display font-medium text-gray-500">The cultural archive is currently vacant.</p>
                    <p className="text-gray-600 text-sm">Return during the next synchronization cycle.</p>
                </div>
                {/* Seed Button only for Admins (we don't have auth context here easily, but we can try writing and if it fails, it fails) 
                    Actually, let's use a hidden trick or just show it during development. 
                    Better: Import useAuth and show it only if isAdmin.
                */}
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
        <div className="space-y-24 py-12">
            {/* Hero Section */}
            {featured && (
                <section>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative rounded-[4rem] overflow-hidden aspect-[21/9] min-h-[600px] border border-white/5 group ring-1 ring-white/10"
                    >
                        <img
                            src={featured.image}
                            alt={featured.title}
                            className="absolute inset-0 w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="absolute inset-0 flex flex-col justify-end p-12 md:p-24">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="max-w-3xl space-y-8"
                            >
                                <Badge className="bg-primary text-black font-black uppercase tracking-widest px-6 py-2 rounded-full text-xs shadow-xl shadow-primary/20">
                                    {featured.featured ? "Lead Feature" : "Top Dispatch"}
                                </Badge>
                                <h1 className="text-6xl md:text-[9rem] font-display font-black text-white tracking-tightest leading-[0.85] uppercase">
                                    {featured.title}
                                </h1>
                                <p className="text-gray-400 text-2xl font-medium leading-relaxed max-w-2xl border-l-4 border-primary pl-8">
                                    {featured.excerpt}
                                </p>
                                <div className="flex flex-wrap items-center gap-12 pt-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-xl">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Analyst</p>
                                            <span className="text-sm font-bold text-white uppercase tracking-widest">{featured.author}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 backdrop-blur-xl">
                                            <Clock className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Duration</p>
                                            <span className="text-sm font-bold text-white uppercase tracking-widest">{featured.readTime}</span>
                                        </div>
                                    </div>
                                    <button className="ml-auto bg-white text-black px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-primary transition-all flex items-center gap-4 group/btn">
                                        Review Intellectual Asset <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-2 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Articles Grid */}
            <section className="space-y-16">
                <div className="flex items-end justify-between border-b border-white/5 pb-12">
                    <div>
                        <h2 className="text-5xl font-display font-black text-white tracking-tightest leading-none uppercase">Intel <span className="text-primary">Dispatches</span></h2>
                        <p className="text-gray-500 mt-4 text-xl font-medium">Monthly long-form metadata from global nodes.</p>
                    </div>
                    <div className="flex gap-4">
                        {['All', 'Interviews', 'Culture', 'Gear'].map((tag) => (
                            <button key={tag} className="px-6 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                    {others.map((article, i) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="group flex flex-col"
                        >
                            <div className="aspect-[16/11] rounded-[3.5rem] overflow-hidden mb-10 relative border border-white/5 ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700 shadow-2xl">
                                <img
                                    src={article.image}
                                    alt={article.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-8 left-8">
                                    <Badge className="bg-black/80 backdrop-blur-2xl text-white border-white/10 font-bold uppercase tracking-[0.2em] px-5 py-2 text-[9px] rounded-xl shadow-2xl">
                                        {article.category}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-6 px-4">
                                <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                                    <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {article.readTime}</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                    <span>{article.author}</span>
                                </div>
                                <h3 className="text-4xl font-bold text-white leading-[1.1] group-hover:text-primary transition-colors duration-500 tracking-tightest">
                                    {article.title}
                                </h3>
                                <p className="text-gray-500 font-medium leading-relaxed line-clamp-3 text-lg">
                                    {article.excerpt}
                                </p>
                                <button className="flex items-center gap-3 text-primary font-black uppercase text-[11px] tracking-[0.3em] pt-8 group-hover:gap-6 transition-all">
                                    Read Data Stream <ArrowRight className="h-5 w-5" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Newsletter Section */}
            <section className="pt-24">
                <div className="bg-primary rounded-[5rem] p-16 md:p-32 flex flex-col md:flex-row items-center justify-between gap-16 overflow-hidden relative shadow-2xl shadow-primary/20">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[800px] h-[800px] bg-black/10 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-white/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10 max-w-2xl space-y-8">
                        <Badge className="bg-black text-white font-black uppercase tracking-widest px-6 py-2 rounded-full text-[10px]">Transmission Hub</Badge>
                        <h2 className="text-6xl md:text-[8rem] font-display font-black text-black tracking-tighter leading-[0.85] uppercase">Join the <br />Sonic <br />Protocol</h2>
                        <p className="text-black/70 text-2xl font-bold leading-relaxed max-w-lg">Get high-fidelity vinyl dispatches and studio intelligence directly to your terminal.</p>
                    </div>

                    <div className="relative z-10 w-full md:w-[500px]">
                        <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
                            <div className="flex bg-black p-3 rounded-[2.5rem] border border-black/5 shadow-2xl">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter Terminal ID (Email)"
                                    className="bg-transparent border-0 focus:ring-0 text-white placeholder:text-white/30 font-black uppercase tracking-widest text-sm px-8 w-full outline-none"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isSubscribing}
                                    className="bg-primary text-black px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/40 disabled:opacity-50"
                                >
                                    {isSubscribing ? "Linking..." : "Initialize"}
                                </button>
                            </div>
                            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest text-center">Encrypted via SonicVault Protocol 3.0</p>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}
