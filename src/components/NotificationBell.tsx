import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Clock, ExternalLink } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc
} from "firebase/firestore";
import { TEXTS } from "@/constants/texts";

interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    read: boolean;
    timestamp: any;
    order_id: string;
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const openOrderDrawer = (orderId: string) => {
        navigate(`/profile?order=${orderId}`);
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Real-time listener for user's notifications
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("user_id", "==", user.uid),
            orderBy("timestamp", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            setNotifications(
                snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
            );
        }, (error) => {
            console.error("Notification listener error:", error);
        });

        return () => unsub();
    }, [user]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (notifId: string) => {
        try {
            await updateDoc(doc(db, "notifications", notifId), { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => !n.read);
        await Promise.all(unread.map(n => markAsRead(n.id)));
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return TEXTS.common.now;
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const diff = Date.now() - date.getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return TEXTS.common.now;
            if (mins < 60) return `${mins}m`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours}h`;
            const days = Math.floor(hours / 24);
            return `${days}d`;
        } catch {
            return TEXTS.common.recent;
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                title={TEXTS.common.notifications}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-secondary text-black text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg shadow-secondary/30"
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="fixed left-4 right-4 top-[72px] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[360px] bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden z-[60] shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                {TEXTS.common.notifications}
                                {unreadCount > 0 && (
                                    <span className="ml-2 text-primary">({unreadCount})</span>
                                )}
                            </span>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                                >
                                    {TEXTS.common.readAll}
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="max-h-[360px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="py-12 text-center">
                                    <Bell className="h-8 w-8 text-gray-800 mx-auto mb-3" />
                                    <p className="text-gray-600 text-xs font-bold">{TEXTS.common.noNotifications}</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <button
                                        type="button"
                                        key={notif.id}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!notif.read) markAsRead(notif.id);
                                            setIsOpen(false);
                                            if (notif.order_id) {
                                                openOrderDrawer(notif.order_id);
                                            }
                                        }}
                                        className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-all border-b border-white/[0.03] last:border-0 ${notif.read
                                            ? "opacity-50 hover:opacity-70"
                                            : "bg-primary/[0.03] hover:bg-primary/[0.06]"
                                            }`}
                                    >
                                        {/* Unread indicator */}
                                        <div className="pt-1.5 flex-shrink-0">
                                            {!notif.read ? (
                                                <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
                                            ) : (
                                                <Check className="w-3 h-3 text-gray-700" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{notif.message}</p>
                                        </div>

                                        <span className="text-[9px] font-bold text-gray-700 flex-shrink-0 flex items-center gap-1 pt-0.5">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatTime(notif.timestamp)}
                                        </span>

                                        {notif.order_id && (
                                            <ExternalLink className="h-3 w-3 text-gray-700 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
