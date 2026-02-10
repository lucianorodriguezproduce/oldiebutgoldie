import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Heart, TrendingUp, DollarSign, ExternalLink, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const wantlistItems = [
    {
        id: 1,
        title: "Homework",
        artist: "Daft Punk",
        label: "Virgin",
        year: "1997",
        genre: "Electronic",
        image: "https://i.discogs.com/97y4m-2i11I_b9U6I_L2oD0k9w8=/fit-in/600x600/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/R-5415-1259591461.jpeg.jpg",
        marketPrice: "$45 - $120",
        trend: "up"
    },
    {
        id: 2,
        title: "Selected Ambient Works 85-92",
        artist: "Aphex Twin",
        label: "Apollo",
        year: "1992",
        genre: "Electronic",
        image: "https://i.discogs.com/Y_fUoy8m_P-S-qX0I2q2v6S-k6Y=/fit-in/600x600/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/R-705-1442146194-2706.jpeg.jpg",
        marketPrice: "$60 - $180",
        trend: "stable"
    },
    {
        id: 3,
        title: "Liquid Swords",
        artist: "GZA",
        label: "Geffen Records",
        year: "1995",
        genre: "Hip Hop",
        image: "https://i.discogs.com/6U8Y-eE4s0I_6U8Y-eE4s0I=/fit-in/600x600/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/R-145455-1416757656-7840.jpeg.jpg",
        marketPrice: "$35 - $90",
        trend: "up"
    },
    {
        id: 4,
        title: "Giant Steps",
        artist: "John Coltrane",
        label: "Atlantic",
        year: "1960",
        genre: "Jazz",
        image: "https://i.discogs.com/9S-n5_jR-E_n_n_jR-E_n_n=/fit-in/600x600/filters:strip_icc():format(jpeg):mode_rgb():quality(90)/discogs-images/R-2364024-1279184518.jpeg.jpg",
        marketPrice: "$50 - $250",
        trend: "stable"
    }
];

export default function Wantlist() {
    return (
        <div className="space-y-16">
            <header className="flex flex-col md:flex-row items-end justify-between gap-8">
                <div className="max-w-3xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-primary/10 rounded-2xl">
                            <Heart className="h-8 w-8 text-primary fill-primary" />
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full font-black tracking-widest uppercase text-[10px]">
                            Curated Desires
                        </Badge>
                    </div>
                    <h1 className="text-7xl font-display font-black text-white tracking-tightest leading-none">The <span className="text-primary">Wantlist</span></h1>
                    <p className="text-gray-500 mt-6 text-xl font-medium leading-relaxed">
                        Deterministic tracking of high-value targets. Real-time marketplace intelligence for your most sought-after physical media.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl backdrop-blur-xl min-w-[200px]">
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Estimated Value</div>
                        <div className="text-3xl font-black text-white">$1,842.00</div>
                    </div>
                    <div className="p-6 bg-primary rounded-3xl min-w-[200px] shadow-2xl shadow-primary/20">
                        <div className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-2">Tracked items</div>
                        <div className="text-3xl font-black text-black">24 Active</div>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {wantlistItems.map((item, i) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Card className="bg-transparent border-0 shadow-none group">
                            <CardContent className="p-0">
                                <div className="aspect-square rounded-[2.5rem] overflow-hidden mb-6 relative bg-surface-dark shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700">
                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-110 group-hover:rotate-1 transition-transform duration-1000 grayscale-[0.3] group-hover:grayscale-0"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                                        <button className="w-full bg-primary text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                            Marketplace <ExternalLink className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="absolute top-6 right-6">
                                        <Badge className="bg-black/60 backdrop-blur-xl text-primary border-primary/20 font-black px-3 py-1 text-[10px] uppercase tracking-widest">
                                            {item.genre}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{item.title}</h3>
                                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">{item.artist}</p>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                        <div>
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Range</div>
                                            <div className="text-sm font-black text-white">{item.marketPrice}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Trend</div>
                                            <div className="flex items-center gap-1 text-green-500 font-black text-sm uppercase italic">
                                                {item.trend === "up" && <ArrowUpRight className="h-4 w-4" />}
                                                {item.trend}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </section>

            {/* Marketplace Intelligence */}
            <section className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-12 md:p-20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <div className="flex items-center gap-4">
                            <TrendingUp className="h-8 w-8 text-primary" />
                            <h2 className="text-5xl font-display font-black text-white tracking-tightest leading-none italic">Market <br />Intelligence</h2>
                        </div>
                        <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-lg">
                            Our proprietary algorithm monitors Discogs sales history and marketplace activity 24/7 to provide deterministic buy/sell indicators.
                        </p>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-primary uppercase tracking-widest">Volatility Index</div>
                                <div className="text-3xl font-black text-white">Low</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-primary uppercase tracking-widest">Global Demand</div>
                                <div className="text-3xl font-black text-white">+14.2%</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center">
                        <div className="relative w-full max-w-md aspect-square rounded-full border border-primary/20 flex items-center justify-center animate-pulse-slow">
                            <div className="w-3/4 h-3/4 rounded-full border border-primary/10 flex items-center justify-center">
                                <DollarSign className="h-24 w-24 text-primary opacity-50" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
