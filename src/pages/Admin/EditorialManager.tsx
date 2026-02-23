import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Edit2,
    Trash2,
    Star,
    Clock,
    FileText,
    Users,
    Save,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DriveUpload } from "@/components/Admin/DriveUpload";
import { TEXTS } from "@/constants/texts";

interface Article {
    id: string;
    title: string;
    excerpt: string;
    category: string;
    author: string;
    image: string;
    readTime: string;
    featured: boolean;
    status: 'draft' | 'published';
    createdAt: any;
}

export default function EditorialManager() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentArticle, setCurrentArticle] = useState<Partial<Article> | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth(); // Get user from context

    const [activeSubTab, setActiveSubTab] = useState<"articles" | "subscribers">("articles");
    const [subscribers, setSubscribers] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return; // Don't listen if not authenticated to avoid permission errors

        const qArt = query(collection(db, "editorial"), orderBy("createdAt", "desc"));
        const unsubArt = onSnapshot(qArt, (snap) => {
            setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Article)));
            setLoading(false);
        }, (error) => {
            console.error("Editorial listener error:", error);
            // Don't block the UI, just stop loading
            setLoading(false);
        });

        const qSubs = query(collection(db, "subscribers"), orderBy("subscribedAt", "desc"));
        const unsubSubs = onSnapshot(qSubs, (snap) => {
            setSubscribers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => {
            console.error("Subscribers listener error:", error);
        });

        return () => {
            unsubArt();
            unsubSubs();
        };
    }, [user]); // Re-run when user changes

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Critical Guard: Ensure we have a real Firebase session
        if (!user) {
            console.error("Save aborted: No authenticated user session found.");
            alert("Protocol Violation: Your session has expired. Please log out and back in to authenticate your access.");
            return;
        }

        console.log("Attempting to save. Current User UID:", user.uid);

        try {
            if (currentArticle?.id) {
                await updateDoc(doc(db, "editorial", currentArticle.id), {
                    ...currentArticle,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, "editorial"), {
                    ...currentArticle,
                    createdAt: serverTimestamp(),
                    status: 'draft',
                    featured: false
                });
            }
            setIsEditing(false);
            setCurrentArticle(null);
        } catch (error: any) {
            console.error("Firebase Error saving article:", error);
            if (error.code === 'permission-denied') {
                alert("Permission Denied: Your identity could not be verified by the Security Layer. Try refreshing the page or logging in again.");
            } else {
                alert(`Error saving: ${error.message || error}`);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(TEXTS.admin.editorial.deleteDispatchConfirm)) {
            await deleteDoc(doc(db, "editorial", id));
        }
    };

    const toggleFeatured = async (article: Article) => {
        await updateDoc(doc(db, "editorial", article.id), {
            featured: !article.featured
        });
    };

    return (
        <div className="space-y-10">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">
                        {TEXTS.admin.editorial.title.split(' ')[0]} <span className="text-primary">{TEXTS.admin.editorial.title.split(' ')[1]}</span>
                    </h1>
                    <p className="text-gray-500 mt-4 text-lg font-medium max-w-2xl">{TEXTS.admin.editorial.description}</p>
                </div>
                <Button
                    onClick={() => { setCurrentArticle({}); setIsEditing(true); }}
                    className="bg-primary text-black font-black uppercase tracking-widest px-8 py-6 rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/20"
                >
                    <Plus className="mr-2 h-5 w-5" /> {TEXTS.admin.editorial.newDispatch}
                </Button>
            </header>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/5 space-x-12">
                {[
                    { id: "articles", label: TEXTS.admin.editorial.intelDispatches, icon: FileText },
                    { id: "subscribers", label: TEXTS.admin.editorial.protocolSubscribers, icon: Users },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest pb-6 transition-all relative ${activeSubTab === tab.id ? "text-primary" : "text-gray-500 hover:text-white"
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {activeSubTab === tab.id && (
                            <motion.div layoutId="editorial-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSubTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    {activeSubTab === "articles" ? (
                        <div className="grid grid-cols-1 gap-6">
                            {loading ? (
                                <div className="py-20 text-center text-gray-500 font-black uppercase tracking-widest">{TEXTS.admin.syncing}</div>
                            ) : articles.length === 0 ? (
                                <div className="py-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] space-y-6 text-center">
                                    <FileText className="h-12 w-12 text-gray-700" />
                                    <p className="text-xl font-display font-medium text-gray-500">{TEXTS.admin.editorial.noDispatches}</p>
                                </div>
                            ) : (
                                articles.map((article) => (
                                    <Card key={article.id} className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden group hover:border-white/10 transition-all">
                                        <div className="flex flex-col md:flex-row">
                                            <div className="w-full md:w-64 aspect-square md:aspect-auto overflow-hidden relative">
                                                <img src={article.image} alt={article.title} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" />
                                                {article.featured && (
                                                    <div className="absolute top-4 left-4 bg-primary text-black p-2 rounded-xl shadow-lg">
                                                        <Star className="h-4 w-4 fill-current" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 p-8 flex flex-col justify-between">
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-white/5 text-gray-400 border-white/5 uppercase tracking-widest text-[10px]">
                                                            {article.category}
                                                        </Badge>
                                                        <Badge className={article.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}>
                                                            {article.status}
                                                        </Badge>
                                                    </div>
                                                    <h3 className="text-2xl font-bold text-white group-hover:text-primary transition-colors">{article.title}</h3>
                                                    <p className="text-gray-500 line-clamp-2">{article.excerpt}</p>
                                                </div>

                                                <div className="flex items-center justify-between mt-8">
                                                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-600">
                                                        <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {article.author}</div>
                                                        <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {article.readTime}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => toggleFeatured(article)}
                                                            className={article.featured ? "text-primary hover:text-primary" : "text-gray-500 hover:text-white"}
                                                        >
                                                            <Star className={article.featured ? "fill-current h-5 w-5" : "h-5 w-5"} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => { setCurrentArticle(article); setIsEditing(true); }}
                                                            className="text-gray-500 hover:text-white"
                                                        >
                                                            <Edit2 className="h-5 w-5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(article.id)}
                                                            className="text-gray-500 hover:text-red-500"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    ) : (
                        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="px-10 py-8 text-[10px] font-black text-gray-500 uppercase tracking-widest">Subscriber ID</th>
                                            <th className="px-10 py-8 text-[10px] font-black text-gray-500 uppercase tracking-widest">Connection Node</th>
                                            <th className="px-10 py-8 text-[10px] font-black text-gray-500 uppercase tracking-widest">Protocol Date</th>
                                            <th className="px-10 py-8 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">{TEXTS.admin.filterAll}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscribers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-10 py-20 text-center text-gray-500 font-bold">{TEXTS.admin.editorial.noSubscribers}</td>
                                            </tr>
                                        ) : (
                                            subscribers.map((sub) => (
                                                <tr key={sub.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-all group">
                                                    <td className="px-10 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                            <span className="text-sm font-black text-white">{sub.id.slice(0, 8)}...</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 text-sm text-gray-400 group-hover:text-white transition-colors">{sub.email}</td>
                                                    <td className="px-10 py-6 text-xs text-gray-600 font-mono">
                                                        {sub.subscribedAt?.toDate().toLocaleDateString() || "Unknown"}
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={async () => {
                                                                if (confirm(TEXTS.admin.editorial.terminateSubConfirm)) {
                                                                    await deleteDoc(doc(db, "subscribers", sub.id));
                                                                }
                                                            }}
                                                            className="text-gray-500 hover:text-red-500"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditing && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
                            onClick={() => setIsEditing(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-10 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-3xl font-black text-white uppercase tracking-tightest">
                                    {currentArticle?.id ? TEXTS.admin.editorial.modifyDispatch : TEXTS.admin.editorial.initialiseDispatch}
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-white">
                                    <X className="h-8 w-8" />
                                </Button>
                            </div>

                            <form onSubmit={handleSave} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label htmlFor="article-title" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.dispatchTitle}</label>
                                        <input
                                            id="article-title"
                                            name="title"
                                            value={currentArticle?.title || ""}
                                            onChange={e => setCurrentArticle({ ...currentArticle, title: e.target.value })}
                                            className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none"
                                            placeholder="..."
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="article-category" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.intelCategory}</label>
                                        <select
                                            id="article-category"
                                            name="category"
                                            value={currentArticle?.category || ""}
                                            onChange={e => setCurrentArticle({ ...currentArticle, category: e.target.value })}
                                            className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none"
                                            required
                                        >
                                            <option value="" className="bg-black">Select Category</option>
                                            <option value="Interviews" className="bg-black">Interviews</option>
                                            <option value="Culture" className="bg-black">Culture</option>
                                            <option value="Architecture" className="bg-black">Architecture</option>
                                            <option value="Gear Reviews" className="bg-black">Gear Reviews</option>
                                            <option value="Crate Digging" className="bg-black">Crate Digging</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="article-excerpt" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.briefExcerpt}</label>
                                    <textarea
                                        id="article-excerpt"
                                        name="excerpt"
                                        value={currentArticle?.excerpt || ""}
                                        onChange={e => setCurrentArticle({ ...currentArticle, excerpt: e.target.value })}
                                        className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none h-24 resize-none"
                                        placeholder="..."
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-2">
                                        <label htmlFor="article-author" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.authorName}</label>
                                        <input
                                            id="article-author"
                                            name="author"
                                            value={currentArticle?.author || ""}
                                            onChange={e => setCurrentArticle({ ...currentArticle, author: e.target.value })}
                                            className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none"
                                            placeholder="..."
                                            required
                                        />
                                    </div>
                                    <div className="space-y-4 md:col-span-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label htmlFor="article-image" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.imageSource}</label>
                                                <input
                                                    id="article-image"
                                                    name="image"
                                                    value={currentArticle?.image || ""}
                                                    onChange={e => setCurrentArticle({ ...currentArticle, image: e.target.value })}
                                                    className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none"
                                                    placeholder="..."
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="article-readTime" className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{TEXTS.admin.editorial.readDuration}</label>
                                                <input
                                                    id="article-readTime"
                                                    name="readTime"
                                                    value={currentArticle?.readTime || ""}
                                                    onChange={e => setCurrentArticle({ ...currentArticle, readTime: e.target.value })}
                                                    className="w-full bg-white/5 border-white/5 rounded-2xl px-6 py-4 text-white focus:border-primary transition-all outline-none"
                                                    placeholder="..."
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[#CCFF00] uppercase tracking-widest px-4">Sincronización Google Drive (1920x1080)</label>
                                            <DriveUpload onUploadSuccess={(link) => setCurrentArticle({ ...currentArticle, image: link })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-12 pt-4">
                                    <div className="flex items-center gap-4">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{TEXTS.admin.editorial.protocolStatus}:</label>
                                        <div className="flex bg-white/5 p-1 rounded-xl">
                                            {['draft', 'published'].map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => setCurrentArticle({ ...currentArticle, status: s as any })}
                                                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentArticle?.status === s ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 border-t border-white/5 bg-black/40 -mx-10 -mb-10 flex justify-end gap-4">
                                    <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-white font-bold h-14 px-8 rounded-2xl">
                                        {TEXTS.admin.editorial.escAbort}
                                    </Button>
                                    <Button type="submit" className="bg-primary text-black font-black uppercase tracking-widest h-14 px-12 rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/20">
                                        <Save className="mr-2 h-5 w-5" /> {TEXTS.admin.editorial.commitDispatch}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
