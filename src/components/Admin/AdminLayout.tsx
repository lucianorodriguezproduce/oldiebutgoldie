import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Activity, Terminal, Shield, LogOut, Disc, Newspaper, ShoppingBag, BarChart3, UploadCloud } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const { logout } = useAuth();

    const navItems = [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "🚀 Ingesta Masiva", href: "/admin/bulk-upload", icon: UploadCloud },
        { label: "Gestión de Órdenes", href: "/admin/orders", icon: ShoppingBag },
        { label: "Editorial Hub", href: "/admin/editorial", icon: Newspaper },
    ];

    return (
        <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-primary/30">
            {/* Sidebar */}
            <aside className="w-72 border-r border-white/5 bg-[#0a0a0a] flex flex-col">
                <div className="p-8 pb-12">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="p-2.5 bg-primary rounded-xl shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                            <Disc className="h-6 w-6 text-black" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black tracking-tighter uppercase leading-none">System Pilot</span>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">Admin Interface</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all group",
                                    isActive
                                        ? "bg-primary text-black shadow-lg shadow-primary/10"
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
            <main className="flex-1 overflow-y-auto relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-7xl mx-auto p-12 relative">
                    {children}
                </div>
            </main>
        </div>
    );
}
