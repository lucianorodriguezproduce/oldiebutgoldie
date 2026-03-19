import { Link, useLocation } from "react-router-dom";
import { TEXTS } from "@/constants/texts";
import { Disc, Search, User as UserIcon, LogOut, BookOpen, Clock, Menu, X, ShoppingBag, Box } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { siteConfigService } from "@/services/siteConfigService";
import type { SiteConfig } from "@/services/siteConfigService";

export const Navbar = () => {
    const location = useLocation();
    const { user, isAdmin, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [config, setConfig] = useState<SiteConfig | null>(null);

    // Phase III: Real-time Config Sync y Favicon Dinámico (V11.0)
    useEffect(() => {
        return siteConfigService.onSnapshotConfig((newConfig) => {
            setConfig(newConfig);
            if (newConfig?.logo?.url) {
                const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (link) {
                    link.href = newConfig.logo.url;
                }
            }
        });
    }, []);

    const navItems = [
        { path: "/", label: TEXTS.global.navigation.home, icon: Search },
        { path: "/tienda", label: TEXTS.global.navigation.tienda, icon: Disc },
        ...(config === null || config?.p2p_global_enabled || config?.allow_p2p_public_offers || isAdmin ? [{ path: "/comercio", label: TEXTS.global.navigation.activity, icon: ShoppingBag }] : []),
        { path: "/archivo", label: TEXTS.global.navigation.archivo, icon: Box },
        { path: "/comunidad", label: TEXTS.global.navigation.editorial, icon: BookOpen },
    ];

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    // Body scroll lock when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);


    return (
        <nav className="fixed w-full z-[9999] top-0 left-0 border-b border-white/[0.08] bg-black transition-all duration-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <Link to="/" className="flex items-center gap-3 group">
                        {config?.logo?.url ? (
                            <img
                                src={config.logo.url}
                                alt={TEXTS.global.navigation.brand}
                                className="h-10 w-auto object-contain max-w-[180px] group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <>
                                <Disc className="h-8 w-8 text-primary group-hover:rotate-180 transition-transform duration-700" />
                                <span className="text-xl font-display font-bold text-white tracking-tightest group-hover:text-primary transition-colors">
                                    {TEXTS.global.navigation.brand}
                                </span>
                            </>
                        )}
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-12">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${location.pathname === item.path ? "text-primary" : "text-gray-500 hover:text-white"
                                    }`}
                            >
                                <item.icon className="h-3.5 w-3.5" />
                                {item.label}
                                {location.pathname === item.path && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* NotificationBell — visible on ALL screen sizes when logged in */}
                        {user && <NotificationBell />}

                        {/* Auth / User Section (Desktop only) */}
                        <div className="hidden md:flex items-center gap-4">
                            {isAdmin && (
                                <Link 
                                    to="/admin/trades" 
                                    className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-black transition-all"
                                >
                                    System Pilot
                                </Link>
                            )}
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <Link to="/perfil" className="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/5 hover:bg-white/10 transition-all group relative">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-black font-black text-xs overflow-hidden group-hover:scale-110 transition-transform">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt={user.displayName || "User"} />
                                            ) : (
                                                user.email?.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 truncate max-w-[100px] uppercase tracking-widest group-hover:text-white transition-colors">
                                            {user.displayName || user.email?.split("@")[0]}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                        title={TEXTS.global.navigation.logout || "Terminar Sesión"}
                                    >
                                        <LogOut className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <Link to="/login">
                                    <button className="flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all transform active:scale-95 shadow-lg shadow-primary/10">
                                        <UserIcon className="h-4 w-4" />
                                        {TEXTS.global.navigation.sync}
                                    </button>
                                </Link>
                            )}
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 text-white md:hidden"
                        >
                            {isMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 top-20 bg-black z-[9999] md:hidden flex flex-col p-6 space-y-4 overflow-y-auto"
                    >
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-5 text-xl font-black uppercase tracking-tighter p-6 rounded-[2rem] transition-all border ${location.pathname === item.path ? "bg-primary text-black border-primary" : "text-white bg-[#0A0A0A] border-white/10"
                                    }`}
                            >
                                <item.icon className="h-6 w-6" />
                                {item.label}
                            </Link>
                        ))}
                        {isAdmin && (
                            <Link
                                to="/admin/trades"
                                className="flex items-center gap-5 text-xl font-black uppercase tracking-tighter p-6 rounded-[2rem] transition-all border text-primary bg-[#0A0A0A] border-primary/20"
                            >
                                <ShoppingBag className="h-6 w-6" />
                                System Pilot
                            </Link>
                        )}
                        <div className="mt-auto pt-8 border-t border-white/10 flex flex-col gap-4 pb-12">
                            {user ? (
                                <>
                                    <Link to="/perfil" className="flex items-center gap-4 p-5 rounded-[2rem] bg-[#0A0A0A] text-white border border-white/10 relative">
                                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-black font-black overflow-hidden ring-2 ring-white/10">
                                            {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.email?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="uppercase tracking-[0.2em] font-black text-xs">{user.displayName || user.email?.split("@")[0]}</span>
                                            <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">{TEXTS.global.navigation.profile}</span>
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="flex items-center gap-4 p-6 rounded-[2rem] bg-red-500/10 text-red-500 uppercase tracking-widest font-black border border-red-500/10"
                                    >
                                        <LogOut className="h-6 w-6" />
                                        {TEXTS.global.navigation.logout}
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className="flex items-center justify-center gap-4 p-7 rounded-[2rem] bg-primary text-black font-black uppercase tracking-widest shadow-xl shadow-primary/10">
                                    <UserIcon className="h-6 w-6" />
                                    {TEXTS.global.navigation.sync}
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};
