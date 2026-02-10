import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ArrowRight } from "lucide-react";

const articles = [
    {
        id: 1,
        category: "Interviews",
        title: "Beyond the Synthesizer",
        excerpt: "An exclusive deep dive with the pioneers of the French Touch movement, exploring how they redefined dance music with analog warmth and digital precision.",
        author: "Marcus Veridis",
        date: "Feb 10, 2026",
        readTime: "12 min read",
        image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1000&auto=format&fit=crop",
        featured: true
    },
    {
        id: 2,
        category: "Architecture",
        title: "The Architecture of Sound",
        excerpt: "Inside the studio of a minimalist master. How spatial design and acoustic treatment influence the DNA of electronic compositions.",
        author: "Elena Rossi",
        date: "Feb 08, 2026",
        readTime: "8 min read",
        image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=1000&auto=format&fit=crop"
    },
    {
        id: 3,
        category: "Culture",
        title: "Vinyl Resurgence",
        excerpt: "Why physical media matters more than ever in an age of ephemeral streaming. Collectors discuss the tactile joy of ownership.",
        author: "Julian Thorne",
        date: "Feb 05, 2026",
        readTime: "10 min read",
        image: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?q=80&w=1000&auto=format&fit=crop"
    },
    {
        id: 4,
        category: "Gear Reviews",
        title: "The Analog Renaissance",
        excerpt: "Revisiting the classic drum machines that shaped the sound of the 80s and why they are returning to modern setups.",
        author: "Sarah Chen",
        date: "Feb 01, 2026",
        readTime: "15 min read",
        image: "https://images.unsplash.com/photo-1520529123417-1fdd724d041e?q=80&w=1000&auto=format&fit=crop"
    }
];

export default function Editorial() {
    const featured = articles.find(a => a.featured);
    const others = articles.filter(a => !a.featured);

    return (
        <div className="space-y-24 py-12">
            {/* Hero Section */}
            {featured && (
                <section>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative rounded-[3rem] overflow-hidden aspect-[21/9] min-h-[500px] border border-white/5"
                    >
                        <img
                            src={featured.image}
                            alt={featured.title}
                            className="absolute inset-0 w-full h-full object-cover grayscale-[0.5] hover:grayscale-0 transition-all duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="absolute inset-0 flex flex-col justify-end p-12 md:p-20">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="max-w-3xl space-y-6"
                            >
                                <Badge className="bg-primary text-black font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                    Featured Story
                                </Badge>
                                <h1 className="text-6xl md:text-8xl font-display font-black text-white tracking-tightest leading-none">
                                    {featured.title}
                                </h1>
                                <p className="text-gray-300 text-xl font-medium leading-relaxed max-w-2xl">
                                    {featured.excerpt}
                                </p>
                                <div className="flex items-center gap-8 pt-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                                            <User className="h-5 w-5 text-primary" />
                                        </div>
                                        <span className="text-sm font-bold text-white uppercase tracking-widest">{featured.author}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-500">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-widest">{featured.readTime}</span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Articles Grid */}
            <section className="space-y-12">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-4xl font-display font-black text-white tracking-tightest leading-none">Latest <span className="text-primary">Dispatches</span></h2>
                        <p className="text-gray-500 mt-4 text-lg font-medium">Monthly long-form features from the world of music and art.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                    {others.map((article, i) => (
                        <motion.div
                            key={article.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="group"
                        >
                            <div className="aspect-[16/10] rounded-[2.5rem] overflow-hidden mb-8 relative border border-white/5 ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700">
                                <img
                                    src={article.image}
                                    alt={article.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-6 left-6">
                                    <Badge className="bg-black/60 backdrop-blur-xl text-white border-white/10 font-bold uppercase tracking-widest px-3 py-1">
                                        {article.category}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    <span>{article.date}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span>{article.readTime}</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white leading-tight group-hover:text-primary transition-colors duration-300">
                                    {article.title}
                                </h3>
                                <p className="text-gray-500 font-medium leading-relaxed line-clamp-2">
                                    {article.excerpt}
                                </p>
                                <button className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest pt-4 group-hover:gap-4 transition-all">
                                    Read Analysis <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Newsletter Section */}
            <section>
                <div className="bg-primary rounded-[3rem] p-12 md:p-24 flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden relative">
                    <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-black/5 blur-[100px] rounded-full" />

                    <div className="relative z-10 max-w-xl">
                        <h2 className="text-5xl md:text-7xl font-display font-black text-black tracking-tightest leading-none mb-6">Join the <br />Sonic Protocol</h2>
                        <p className="text-black/60 text-lg font-bold">Get curated vinyl dispatches and studio reports directly to your inbox every full moon.</p>
                    </div>

                    <div className="relative z-10 w-full md:w-auto">
                        <div className="flex bg-black/10 p-2 rounded-full border border-black/5 backdrop-blur-sm min-w-[320px]">
                            <input
                                type="email"
                                placeholder="COMM_CH_ID"
                                className="bg-transparent border-0 focus:ring-0 text-black placeholder:text-black/40 font-black uppercase tracking-widest text-sm px-6 w-full"
                            />
                            <button className="bg-black text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20">
                                Subscribe
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
