import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Truck, AlertTriangle, DollarSign, ChevronRight, Clock } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AdminAlert {
    id: string;
    type: 'logistics' | 'dispute' | 'finance';
    title: string;
    subtitle: string;
    timestamp: any;
    status: string;
}

export default function AdminNotificationBell() {
    const [alerts, setAlerts] = useState<AdminAlert[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Listen to trades with critical statuses
        const q = query(
            collection(db, "trades"),
            where("status", "in", ["payment_confirmed", "disputed", "payment_reported"])
        );

        const unsub = onSnapshot(q, (snap) => {
            const newAlerts: AdminAlert[] = snap.docs.map(doc => {
                const data = doc.data();
                let type: AdminAlert['type'] = 'logistics';
                let title = "Pedido Pendiente";
                
                if (data.status === 'disputed') {
                    type = 'dispute';
                    title = "Disputa Abierta";
                } else if (data.status === 'payment_reported') {
                    type = 'finance';
                    title = "Pago Reportado";
                }

                return {
                    id: doc.id,
                    type,
                    title,
                    subtitle: `ID: #${doc.id.slice(-6)}`,
                    timestamp: data.timestamp,
                    status: data.status
                };
            });
            // Sort by timestamp if available
            setAlerts(newAlerts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        });

        return () => unsub();
    }, []);

    const counts = {
        logistics: alerts.filter(a => a.status === 'payment_confirmed').length,
        dispute: alerts.filter(a => a.status === 'disputed').length,
        finance: alerts.filter(a => a.status === 'payment_reported').length
    };

    const totalCount = alerts.length;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getIcon = (type: AdminAlert['type']) => {
        switch (type) {
            case 'logistics': return <Truck className="w-4 h-4 text-orange-400" />;
            case 'dispute': return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'finance': return <DollarSign className="w-4 h-4 text-primary" />;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-3 bg-white/5 border border-white/10 rounded-2xl hover:border-primary/30 transition-all group"
            >
                <Bell className={cn("w-5 h-5 transition-colors", totalCount > 0 ? "text-primary anim-pulse" : "text-gray-500 group-hover:text-white")} />
                {totalCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-black text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black shadow-lg shadow-primary/20">
                        {totalCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-80 bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    >
                        <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Alertas Operativas</h3>
                            <div className="flex gap-4 mt-3">
                                <div className="flex items-center gap-1.5">
                                    <Truck className="w-3 h-3 text-orange-400" />
                                    <span className="text-xs font-bold text-white">{counts.logistics}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                    <span className="text-xs font-bold text-white">{counts.dispute}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <DollarSign className="w-3 h-3 text-primary" />
                                    <span className="text-xs font-bold text-white">{counts.finance}</span>
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {alerts.length === 0 ? (
                                <div className="p-10 text-center space-y-3 opacity-50">
                                    <Bell className="w-8 h-8 mx-auto text-gray-700" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Sin tareas pendientes</p>
                                </div>
                            ) : (
                                alerts.map((alert) => (
                                    <button
                                        key={alert.id}
                                        onClick={() => {
                                            navigate(`/admin/trades?status=${alert.status}&id=${alert.id}`);
                                            setIsOpen(false);
                                        }}
                                        className="w-full p-4 flex items-start gap-4 hover:bg-white/[0.03] transition-all border-b border-white/5 last:border-0 group text-left"
                                    >
                                        <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                                            {getIcon(alert.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-white group-hover:text-primary transition-colors">{alert.title}</p>
                                            <p className="text-[10px] font-medium text-gray-500">{alert.subtitle}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-800 group-hover:text-white transition-colors self-center" />
                                    </button>
                                ))
                            )}
                        </div>

                        <button 
                            onClick={() => {
                                navigate('/admin/trades');
                                setIsOpen(false);
                            }}
                            className="w-full p-4 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-all border-t border-white/5"
                        >
                            Ver Todo el Panel
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
