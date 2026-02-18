import { Link, useLocation } from "react-router-dom";
import { Disc, Search, User as UserIcon, LogOut, BookOpen, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export const Navbar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navItems = [
        { path: "/", label: "Descubrir", icon: Search },
        { path: "/editorial", label: "Editorial", icon: BookOpen },
    ];

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    return (
        <nav className="fixed w-full z-50 top-0 left-0 border-b border-white/[0.08] bg-black/60 backdrop-blur-2xl backdrop-saturate-[1.8] transition-all duration-500">
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

                    <div className="flex items-center gap-4">
                        {/* Auth / User Section */}
                        <div className="hidden md:flex items-center gap-4">
                            {user ? (
                                <div className="flex items-center gap-6">
                                    <Link to="/profile" className="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/5 hover:bg-white/10 transition-all group">
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
                            className="p-2 text-gray-400 hover:text-white md:hidden"
                        >
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-0 top-20 bg-black z-40 md:hidden flex flex-col p-8 space-y-8"
                    >
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-4 text-2xl font-black uppercase tracking-widest p-4 rounded-3xl transition-all ${location.pathname === item.path ? "bg-primary text-black" : "text-gray-400 hover:text-white bg-white/5"
                                    }`}
                            >
                                <item.icon className="h-6 w-6" />
                                {item.label}
                            </Link>
                        ))}
                        <div className="mt-auto pt-8 border-t border-white/10 flex flex-col gap-4">
                            {user ? (
                                <>
                                    <Link to="/profile" className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 text-gray-400">
                                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-black font-black">
                                            {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.email?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="uppercase tracking-widest font-black">{user.displayName || user.email?.split("@")[0]}</span>
                                    </Link>
                                    <button
                                        onClick={() => logout()}
                                        className="flex items-center gap-4 p-4 rounded-3xl bg-red-500/10 text-red-500 uppercase tracking-widest font-black"
                                    >
                                        <LogOut className="h-6 w-6" />
                                        Salir
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className="flex items-center justify-center gap-4 p-6 rounded-3xl bg-primary text-black font-black uppercase tracking-widest">
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
