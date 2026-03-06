import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLoading } from "@/context/LoadingContext";
import { ShieldAlert, User as UserIcon } from "lucide-react";
import type { DbUser } from "@/types/user";

export default function PublicProfile() {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();
    const { showLoading, hideLoading } = useLoading();

    const [profileUser, setProfileUser] = useState<DbUser | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!username) {
            navigate("/tienda");
            return;
        }

        const fetchProfile = async () => {
            showLoading("Buscando identificador...");
            try {
                const q = query(
                    collection(db, "users"),
                    where("username", "==", username.toLowerCase())
                );
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setNotFound(true);
                    // UX Rule: Delay redirect slightly so they see the missing profile message
                    setTimeout(() => navigate("/tienda"), 3000);
                } else {
                    const doc = snapshot.docs[0];
                    setProfileUser({ id: doc.id, ...doc.data() } as unknown as DbUser);
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
            </div>

            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                    El Coliseo Público y las Bateas Sociales estarán disponibles en la V2.0
                </p>
            </div>
        </div>
    );
}
