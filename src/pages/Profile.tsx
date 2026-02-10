import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    MapPin,
    Award,
    Calendar,
    Music,
    Heart,
    Zap,
    Settings,
    Edit3
} from "lucide-react";
import { discogsService } from "@/lib/discogs";
import { useQuery } from "@tanstack/react-query";
import { AlbumCardSkeleton } from "@/components/ui/Skeleton";
import { Link } from "react-router-dom";

export default function Profile() {
    const { user, isAdmin } = useAuth();

    const { data: recentItems, isLoading } = useQuery({
        queryKey: ["profile-recent"],
        queryFn: () => discogsService.getTrending(),
    });

    const stats = [
        { label: "Collection", value: "124", icon: Music, color: "text-primary" },
        { label: "Wantlist", value: "48", icon: Heart, color: "text-red-500" },
        { label: "Interactions", value: "1.2k", icon: Zap, color: "text-yellow-500" },
    ];

    if (!user && !isAdmin) return null;

    const displayName = user?.displayName || (isAdmin ? "Master Admin" : "Sonic Collector");
    const photoURL = user?.photoURL;

    return (
        <div className="space-y-16 py-10">
            {/* Profile Header */}
            <header className="relative">
                <div className="absolute inset-0 bg-primary/10 blur-[120px] -z-10 rounded-full opacity-50" />

                <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative group"
                    >
                        <div className="h-48 w-48 rounded-[3rem] bg-gradient-to-br from-primary to-primary-dark p-1 shadow-2xl shadow-primary/20 overflow-hidden ring-4 ring-white/5">
                            <div className="w-full h-full rounded-[2.8rem] bg-black flex items-center justify-center overflow-hidden">
                                {photoURL ? (
                                    <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-6xl font-black text-primary">{displayName.charAt(0)}</span>
                                )}
                            </div>
                        </div>
                        <button className="absolute bottom-2 right-2 p-3 bg-white text-black rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
                            <Edit3 className="h-5 w-5" />
                        </button>
                    </motion.div>

                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <div className="space-y-2">
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4">
                                <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">
                                    {displayName}
                                </h1>
                                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1 rounded-full font-black tracking-widest uppercase text-[10px]">
                                    {isAdmin ? "System Architect" : "Pro Collector"}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 text-gray-500 font-bold uppercase tracking-widest text-xs">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <span>Berlin, Germany</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Award className="h-4 w-4 text-primary" />
                                    <span>Elite Tier</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <span>Joined 2024</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <button className="bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary transition-all shadow-xl shadow-white/5">
                                Edit Profile
                            </button>
                            <button className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all">
                                <Settings className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] p-10 hover:border-white/10 transition-all group">
                            <div className="flex items-center justify-between mb-8">
                                <div className={`p-4 bg-white/5 rounded-2xl group-hover:bg-primary/20 transition-colors`}>
                                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-700 group-hover:text-primary transition-colors" />
                            </div>
                            <div className="text-5xl font-black text-white tracking-tighter mb-2">{stat.value}</div>
                            <div className="text-gray-500 text-xs font-black uppercase tracking-widest">{stat.label}</div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Collection Highlights */}
            <section className="space-y-10">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-4xl font-display font-black text-white tracking-tightest leading-none">Collection <span className="text-primary">Highlights</span></h2>
                        <p className="text-gray-500 mt-4 text-lg font-medium">Your most played and valued sonic assets.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => <AlbumCardSkeleton key={i} />)
                    ) : (
                        recentItems?.slice(0, 6).map((item: any, i: number) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link to={`/album/${item.id}`} className="group block">
                                    <div className="aspect-square rounded-[2rem] overflow-hidden mb-4 relative ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-700">
                                        <img
                                            src={item.cover_image || item.thumb}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.5] group-hover:grayscale-0"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                            <span className="text-white text-[10px] font-black uppercase tracking-widest">Details</span>
                                        </div>
                                    </div>
                                    <h3 className="text-white font-bold text-sm truncate group-hover:text-primary transition-colors">{item.title}</h3>
                                </Link>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

function ArrowUpRight({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M7 7h10v10" /><path d="M7 17 17 7" />
        </svg>
    );
}
