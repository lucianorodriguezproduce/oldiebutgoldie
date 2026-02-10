import { Link, useLocation } from "react-router-dom";
import { Disc, Search, Library, User as UserIcon, LogOut, Heart, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";

export const Navbar = () => {
    const location = useLocation();
    const { user, logout } = useAuth();

    const navItems = [
        { path: "/", label: "Discover", icon: Search },
        { path: "/collection", label: "Archive", icon: Library },
        { path: "/wantlist", label: "Wantlist", icon: Heart },
        { path: "/editorial", label: "Editorial", icon: BookOpen },
    ];

    return (
        <nav className="fixed w-full z-50 top-0 left-0 border-b border-white/[0.08] bg-black/60 backdrop-blur-2xl backdrop-saturate-[1.8] transition-all duration-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <Link to="/" className="flex items-center gap-3 group">
                        <Disc className="h-8 w-8 text-primary group-hover:rotate-180 transition-transform duration-700" />
                        <span className="text-xl font-display font-bold text-white tracking-tightest group-hover:text-primary transition-colors">SonicVault</span>
                    </Link>

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
                        {user ? (
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/5">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-black font-black text-xs overflow-hidden">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt={user.displayName || "User"} />
                                        ) : (
                                            user.email?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <span className="text-[10px] font-black text-gray-400 truncate max-w-[100px] uppercase tracking-widest">
                                        {user.displayName || user.email?.split("@")[0]}
                                    </span>
                                </div>
                                <button
                                    onClick={() => logout()}
                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                    title="Protocol Termination"
                                >
                                    <LogOut className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <Link to="/login">
                                <button className="flex items-center gap-2 bg-primary text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all transform active:scale-95 shadow-lg shadow-primary/10">
                                    <UserIcon className="h-4 w-4" />
                                    Synchronize
                                </button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
