import { useState, useEffect } from "react";
import { Search, User, ShieldAlert, Loader2 } from "lucide-react";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { siteConfigService } from "@/services/siteConfigService";
import type { SiteConfig } from "@/services/siteConfigService";
import type { DbUser } from "@/types/user";

export default function SocialRadar() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<DbUser[]>([]);
    const [hasAttempted, setHasAttempted] = useState(false);
    const { isAdmin } = useAuth();
    const [config, setConfig] = useState<SiteConfig | null>(null);

    useEffect(() => {
        return siteConfigService.onSnapshotConfig(setConfig);
    }, []);

    useEffect(() => {
        if (searchTerm.trim().length < 3) {
            setResults([]);
            setHasAttempted(false);
            return;
        }

        const handleSearch = async () => {
            setIsSearching(true);
            setHasAttempted(true);
            try {
                // To allow basic prefix search in Firestore without third-party services like Algolia:
                // we search users whose username is >= term and <= term + '\uf8ff'
                const searchLower = searchTerm.toLowerCase();

                const q = query(
                    collection(db, "users"),
                    where("username", ">=", searchLower),
                    where("username", "<=", searchLower + "\uf8ff"),
                    limit(5)
                );

                const snap = await getDocs(q);
                const found: DbUser[] = [];
                snap.forEach(doc => {
                    found.push({ id: doc.id, ...doc.data() } as unknown as DbUser);
                });
                setResults(found);
            } catch (err) {
                console.error("Radar Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(handleSearch, 400); // 400ms debounce
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    return (
        <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={!config?.allow_user_friendships && !isAdmin}
                    placeholder={(!config?.allow_user_friendships && !isAdmin) ? "Radar Desactivado" : "Radar P2P: Busca por @username..."}
                    className={`w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-500 font-mono focus:outline-none focus:border-primary/50 transition-colors ${(!config?.allow_user_friendships && !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {isSearching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}
            </div>

            {(!config?.allow_user_friendships && !isAdmin) && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-red-400 mx-auto" />
                    <p className="text-red-400 font-bold text-sm tracking-widest uppercase">Frecuencia Restringida</p>
                    <p className="text-[10px] text-gray-600 font-medium">Las conexiones sociales han sido desactivadas por el administrador.</p>
                </div>
            )}

            {hasAttempted && !isSearching && results.length === 0 && searchTerm.length >= 3 && (
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-center space-y-2 translate-y-2 opacity-0 animate-[fade-in-up_0.3s_ease-out_forwards]">
                    <ShieldAlert className="w-8 h-8 text-gray-600 mx-auto" />
                    <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Sin Señal</p>
                    <p className="text-[10px] text-gray-500 font-medium">Ningún gladiador coincide con esas coordenadas.</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-2">
                    {results.map((profile) => (
                        <Link
                            key={profile.uid}
                            to={`/u/${profile.username}`}
                            className="flex items-center justify-between bg-[#0a0a0a] border border-white/5 hover:border-primary/30 p-4 rounded-xl transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                    <User className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <p className="text-white font-black uppercase tracking-tight text-sm">@{profile.username}</p>
                                    <p className="text-gray-500 font-bold text-[10px] tracking-widest uppercase">{profile.display_name}</p>
                                </div>
                            </div>

                            <span className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-[10px] font-black tracking-widest uppercase group-hover:bg-primary group-hover:text-black transition-colors">
                                Inspeccionar
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
