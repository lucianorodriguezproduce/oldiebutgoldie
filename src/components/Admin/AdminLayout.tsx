import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
    LayoutDashboard, 
    Shield, 
    LogOut, 
    Disc, 
    Newspaper, 
    ShoppingBag, 
    UploadCloud, 
    Handshake, 
    Package, 
    Trash2,
    Terminal,
    Menu,
    X,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AdminLogo from "./AdminLogo";
import AdminNotificationBell from "./AdminNotificationBell";

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const { logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const navItems = [
        { label: "Estadísticas", href: "/admin", icon: LayoutDashboard },
        { label: "🚚 Ventas / Despachos", href: "/admin/trades?view=direct_sale", icon: ShoppingBag },
        { label: "🤝 Intercambios P2P", href: "/admin/trades?view=exchange", icon: Handshake },
        { label: "📦 Inventario Pro", href: "/admin/inventory", icon: Package },
        { label: "🚀 Ingesta Masiva", href: "/admin/bulk-upload", icon: UploadCloud },
        { label: "💎 Colección", href: "/admin/collection", icon: Disc },
        { label: "Identidad Marca", href: "/admin/branding", icon: Shield },
        { label: "Permisos", href: "/admin/permissions", icon: Terminal },
        { label: "Editorial Hub", href: "/admin/editorial", icon: Newspaper },
        { label: "🔥 Purga Total", href: "/admin/purge", icon: Trash2 },
    ];

    return (
        <div className="flex flex-col md:flex-row h-screen bg-[#050505] text-white font-sans selection:bg-primary/30">
            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-b border-white/5 z-[60]">
                <AdminLogo showText={false} className="scale-75 origin-left" />
                <div className="flex items-center gap-4">
                    <AdminNotificationBell />
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 text-gray-400 hover:text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Sidebar / Overlay mobile */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] md:hidden"
                    />
                )}
            </AnimatePresence>

            <aside className={cn(
                "fixed inset-y-0 left-0 w-72 bg-[#0a0a0a] border-r border-white/5 flex flex-col z-[80] transition-transform duration-300 md:relative md:translate-x-0 overflow-y-auto shadow-2xl shadow-black",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-8 pb-12 flex items-center justify-between">
                    <AdminLogo />
                    <button 
                        onClick={() => setIsSidebarOpen(false)}
                        className="md:hidden p-2 text-gray-500 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all group",
                                    isActive
                                        ? "bg-primary text-black shadow-lg shadow-primary/20 border-b-2 border-primary/40"
                                        : "text-gray-500 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", isActive ? "text-black" : "text-gray-500 group-hover:text-primary")} />
                                <span className="text-sm tracking-tight">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto">
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-4 px-6 py-4 text-gray-500 hover:text-red-400 font-bold rounded-2xl hover:bg-red-400/5 transition-all"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="text-sm">Disconnect</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative min-w-0">
                <div className="absolute top-0 right-0 w-full max-w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                
                {/* Desktop TopBar for Notifications (Hidden on mobile as it's in header) */}
                <div className="hidden md:flex justify-end p-8 pb-0">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Estado del Sistema</span>
                            <span className="text-[10px] font-bold text-primary uppercase">🌟 Oldie but Goldie Oficial</span>
                        </div>
                        <AdminNotificationBell />
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6 md:p-12 relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
