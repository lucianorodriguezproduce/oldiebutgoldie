import { Link, useLocation } from "react-router-dom";
import { Disc, Search, User as UserIcon, LogOut, BookOpen, Clock, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import { db } from "@/lib/firebase";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";

export const Navbar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { hasActiveOffer } = useOrderNotifications();

    const navItems = [
        { path: "/", label: "Descubrir", icon: Search },
        { path: "/actividad", label: "Actividad", icon: Clock },
        { path: "/editorial", label: "Editorial", icon: BookOpen },
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
                        <Disc className="h-8 w-8 text-primary group-hover:rotate-180 transition-transform duration-700" />
                        <span className="text-xl font-display font-bold text-white tracking-tightest group-hover:text-primary transition-colors">Oldie but Goldie</span>
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
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <Link to="/profile" className="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/5 hover:bg-white/10 transition-all group relative">
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

                                        {/* Notification Indicator Dot */}
                                        {hasActiveOffer && (
                                            <div className="absolute -top-1 -right-1 z-10">
                                                <motion.span
                                                    animate={{
                                                        scale: [1, 1.5, 1],
                                                        opacity: [0.8, 0, 0.8]
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                    className="absolute inset-0 w-3 h-3 bg-[#CCFF00] rounded-full blur-[2px]"
                                                />
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="relative block w-3 h-3 bg-[#CCFF00] rounded-full border-2 border-black shadow-[0_0_10px_rgba(204,255,0,0.8)]"
                                                />
                                            </div>
                                        )}
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                        title="Terminar Sesión"
                                    >
                                        <LogOut className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <Link to="/login">
                                    <button className="flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all transform active:scale-95 shadow-lg shadow-primary/10">
                                        <UserIcon className="h-4 w-4" />
                                        Sincronizar
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
                        <div className="mt-auto pt-8 border-t border-white/10 flex flex-col gap-4 pb-12">
                            {user ? (
                                <>
                                    <Link to="/profile" className="flex items-center gap-4 p-5 rounded-[2rem] bg-[#0A0A0A] text-white border border-white/10 relative">
                                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-black font-black overflow-hidden ring-2 ring-white/10">
                                            {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.email?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="uppercase tracking-[0.2em] font-black text-xs">{user.displayName || user.email?.split("@")[0]}</span>
                                            <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">Ver Perfil</span>
                                        </div>

                                        {/* Mobile Notification Indicator Dot */}
                                        {hasActiveOffer && (
                                            <div className="absolute top-4 right-6 z-10">
                                                <motion.span
                                                    animate={{
                                                        scale: [1, 2, 1],
                                                        opacity: [0.6, 0, 0.6]
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                    className="absolute inset-0 w-4 h-4 bg-[#CCFF00] rounded-full blur-[4px]"
                                                />
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="relative block w-4 h-4 bg-[#CCFF00] rounded-full border-2 border-[#0A0A0A] shadow-[0_0_15px_rgba(204,255,0,0.8)]"
                                                />
                                            </div>
                                        )}
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="flex items-center gap-4 p-6 rounded-[2rem] bg-red-500/10 text-red-500 uppercase tracking-widest font-black border border-red-500/10"
                                    >
                                        <LogOut className="h-6 w-6" />
                                        Cerrar Sesión
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className="flex items-center justify-center gap-4 p-7 rounded-[2rem] bg-primary text-black font-black uppercase tracking-widest shadow-xl shadow-primary/10">
                                    <UserIcon className="h-6 w-6" />
                                    Sincronizar
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};
