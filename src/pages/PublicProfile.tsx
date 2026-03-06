import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLoading } from "@/context/LoadingContext";
import { ShieldAlert, User as UserIcon, Lock, Users, ArrowRight, Clock, Ban } from "lucide-react";
import type { DbUser } from "@/types/user";
import { useAuth } from "@/context/AuthContext";
import { getConnectionStatus, requestConnection, acceptConnection, breakConnection } from "@/services/connectionService";
import { siteConfigService } from "@/services/siteConfigService";
import type { SiteConfig } from "@/services/siteConfigService";
import type { ConnectionStatus } from "@/types/connection";

export default function PublicProfile() {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();

    const [profileUser, setProfileUser] = useState<DbUser | null>(null);
    const [notFound, setNotFound] = useState(false);

    // Auth & Connections
    const { dbUser, isAdmin } = useAuth();
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [config, setConfig] = useState<SiteConfig | null>(null);

    useEffect(() => {
        if (!username) {
            navigate("/tienda");
            return;
        }

        const fetchProfile = async () => {
            showLoading("Buscando identificador...");
            try {
                // HOTFIX: Use usernames registry to find UID (more secure than listing the users collection)
                const usernameRef = doc(db, "usernames", username.toLowerCase());
                const usernameSnap = await getDoc(usernameRef);

                if (!usernameSnap.exists()) {
                    setNotFound(true);
                    setTimeout(() => navigate("/tienda"), 3000);
                    return;
                }

                const uid = usernameSnap.data().uid;
                const userSnap = await getDoc(doc(db, "users", uid));

                if (!userSnap.exists()) {
                    setNotFound(true);
                    setTimeout(() => navigate("/tienda"), 3000);
                } else {
                    setProfileUser({ id: userSnap.id, ...userSnap.data() } as unknown as DbUser);
                }
            } catch (error) {
                console.error("Error fetching public profile:", error);
                setNotFound(true);
            } finally {
                hideLoading();
            }
        };

        fetchProfile();
    }, [username, navigate, showLoading, hideLoading]);

    // Check connection status after profile loads
    useEffect(() => {
        if (!dbUser || !profileUser) return;

        // You cannot connect with yourself
        if (dbUser.uid === profileUser.uid) return;

        const checkStatus = async () => {
            const status = await getConnectionStatus(dbUser.uid, profileUser.uid!);
            setConnectionStatus(status);
        };
        checkStatus();
    }, [dbUser, profileUser]);

    // Phase III: Subscribe to Site Config
    useEffect(() => {
        return siteConfigService.onSnapshotConfig(setConfig);
    }, []);

    const handleConnectionAction = async () => {
        if (!dbUser || !profileUser) return;
        setIsActionLoading(true);
        try {
            if (!connectionStatus) {
                // Request
                await requestConnection(dbUser, profileUser.uid!);
                setConnectionStatus("pending");
            } else if (connectionStatus === "accepted" || connectionStatus === "pending") {
                // Remove or Cancel
                await breakConnection(dbUser.uid, profileUser.uid!);
                setConnectionStatus(null);
            }
        } catch (error: any) {
            console.error("Connection action failed:", error);
            if (error.message === "SOCIAL_IDENTITY_REQUIRED") {
                alert("Debes reclamar tu Identidad Social para conectar con otros gladiadores.");
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    if (notFound) {
        return (
            <div className="min-h-screen py-20 flex flex-col items-center justify-center space-y-6 text-center px-4">
                <ShieldAlert className="w-16 h-16 text-primary animate-pulse" />
                <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
                    Identificador Desconocido
                </h1>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest max-w-md">
                    El usuario @{username} no existe o aún no ha configurado su identidad P2P.
                </p>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest animate-pulse mt-8">
                    Redirigiendo a las bateas...
                </p>
            </div>
        );
    }

    if (!profileUser) return null;

    return (
        <div className="min-h-[80vh] py-10 space-y-10">
            {/* Minimalist Profile Header for V2 Identity Prep */}
            <div className="flex flex-col items-center justify-center p-12 bg-[#050505] border border-white/5 rounded-[2rem] space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border-4 border-primary/20">
                    <UserIcon className="w-10 h-10 text-primary" />
                </div>

                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">
                        @{profileUser.username}
                    </h1>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {profileUser.display_name}
                    </p>
                </div>

                <div className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Identidad Social Verificada ✓
                </div>

                {/* Connection Controls */}
                {dbUser && dbUser.uid !== profileUser.uid && (config?.allow_user_friendships || isAdmin) && (
                    <div className="pt-4 flex flex-col items-center space-y-3">
                        <button
                            onClick={handleConnectionAction}
                            disabled={isActionLoading || connectionStatus === "blocked"}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${connectionStatus === "accepted"
                                ? "bg-white/5 text-red-400 hover:bg-red-500/20"
                                : connectionStatus === "pending"
                                    ? "bg-white/10 text-gray-400 hover:bg-red-500/20"
                                    : connectionStatus === "blocked"
                                        ? "bg-red-500/10 text-red-500 cursor-not-allowed"
                                        : "bg-primary text-black hover:scale-105"
                                }`}
                        >
                            {isActionLoading ? <Clock className="w-4 h-4 animate-spin" /> :
                                connectionStatus === "accepted" ? <><Users className="w-4 h-4" /> Desconectar</> :
                                    connectionStatus === "pending" ? <><Clock className="w-4 h-4" /> Cancelar Solicitud</> :
                                        connectionStatus === "blocked" ? <><Ban className="w-4 h-4" /> Uso Restringido</> :
                                            <><Users className="w-4 h-4" /> Conectar</>
                            }
                        </button>
                    </div>
                )}

                {dbUser && dbUser.uid !== profileUser.uid && !config?.allow_user_friendships && !isAdmin && (
                    <div className="pt-4 px-6 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center">
                            Conexiones temporalmente restringidas
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. PUBLIC SECTOR (Always visible) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h2 className="text-xl font-display font-black text-white uppercase tracking-tighter">
                            Mercado Abierto
                        </h2>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-2 py-1 rounded-md">
                            Público
                        </span>
                    </div>

                    <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-[#0a0a0a]">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest flex flex-col items-center gap-2">
                            <Lock className="w-5 h-5 opacity-50" />
                            Aún no ha expuesto órdenes públicas
                        </p>
                    </div>
                </div>

                {/* 2. PRIVATE SECTOR (Only Connections & Owner) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h2 className="text-xl font-display font-black text-white uppercase tracking-tighter">
                            Colección Privada
                        </h2>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-1 rounded-md">
                            Solo Conexiones
                        </span>
                    </div>

                    {connectionStatus === "accepted" || dbUser?.uid === profileUser.uid ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-[#0a0a0a]">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                                Bateas sociales en desarrollo para V2.0
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/40 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
                            <div className="relative z-20 flex flex-col items-center gap-4">
                                <Lock className="w-8 h-8 text-white/20" />
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest max-w-[200px]">
                                    Conecta para desbloquear su Colección Completa
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
