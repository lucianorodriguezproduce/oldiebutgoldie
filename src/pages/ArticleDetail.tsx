import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, User, Share2, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLoading } from "@/context/LoadingContext";
import { useEffect } from "react";
import { LazyImage } from "@/components/ui/LazyImage";
import { TEXTS } from "@/constants/texts";
import { SEO } from "@/components/SEO";
import { trackEvent } from "@/components/AnalyticsProvider";

interface Article {
    id?: string;
    category: string;
    title: string;
    excerpt: string;
    content: string;
    author: string;
    readTime: string;
    image: string;
    createdAt: any;
    slug?: string;
    _redirectUrl?: string;
}

export default function ArticleDetail() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { showLoading, hideLoading } = useLoading();

    const { data: article, isLoading } = useQuery({
        queryKey: ['article', id],
        queryFn: async () => {
            if (!id) return null;
            const articlesRef = collection(db, "editorial");
            const q = query(articlesRef, where("slug", "==", id), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                return { ...querySnapshot.docs[0].data(), id: querySnapshot.docs[0].id } as Article;
            }

            const docRef = doc(db, "editorial", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const docData = docSnap.data() as Article;
                if (docData.slug) {
                    return { ...docData, id: docSnap.id, _redirectUrl: `/editorial/${docData.slug}` };
                }
                return { ...docData, id: docSnap.id };
            }
            return null;
        }
    });

    useEffect(() => {
        if (article?._redirectUrl) {
            navigate(article._redirectUrl, { replace: true });
        }
    }, [article, navigate]);

    // GA4 Sensor: Editorial Read Tracking (>30s dwell time)
    useEffect(() => {
        if (!article || !article.id) return;

        const timer = setTimeout(() => {
            trackEvent('editorial_read', {
                article_id: article.id,
                article_title: article.title,
                article_category: article.category
            });
        }, 30000); // Trigger after 30 seconds

        return () => clearTimeout(timer);
    }, [article]);

    useEffect(() => {
        if (isLoading) {
            showLoading(TEXTS.common.loadingArticle);
        } else {
            hideLoading();
        }
        return () => hideLoading();
    }, [isLoading]);

    if (isLoading || article?._redirectUrl) {
        return null;
    }

    if (!article) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
                <h1 className="text-4xl font-display font-bold text-white">{TEXTS.common.articleNotFound}</h1>
                <Link to="/editorial">
                    <button className="text-primary uppercase font-black tracking-widest hover:underline">{TEXTS.common.backToEditorial}</button>
                </Link>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto py-8 md:py-16 px-4 md:px-0"
        >
            <SEO
                title={`${article.title} | Editorial Oldie but Goldie`}
                description={article.excerpt}
                image={article.image}
            />
            <Link to="/editorial" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary transition-colors mb-12 group">
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">{TEXTS.common.backToEditorial}</span>
            </Link>

            <header className="space-y-8 md:space-y-12 mb-12 md:mb-16">
                <Badge className="bg-primary text-black font-black uppercase tracking-widest px-6 py-2 rounded-full text-[10px] md:text-xs">
                    {article.category}
                </Badge>

                <h1 className="text-5xl md:text-8xl font-display font-black text-white leading-[1.1] md:leading-[1] tracking-tightest uppercase">
                    {article.title}
                </h1>

                <p className="text-xl md:text-3xl text-gray-400 font-medium leading-relaxed italic border-l-4 border-primary pl-8">
                    {article.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-8 md:gap-12 py-8 border-y border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{TEXTS.common.author}</p>
                            <span className="text-sm font-bold text-white uppercase tracking-widest">{article.author}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                            <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{TEXTS.common.readingTime}</p>
                            <span className="text-sm font-bold text-white uppercase tracking-widest">{article.readTime}</span>
                        </div>
                    </div>
                    <button className="ml-auto flex items-center gap-3 text-gray-500 hover:text-white transition-colors">
                        <Share2 className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{TEXTS.common.share}</span>
                    </button>
                </div>
            </header>

            <div className="aspect-[21/9] rounded-[2rem] md:rounded-[4rem] overflow-hidden mb-16 md:mb-24 border border-white/5 ring-1 ring-white/10">
                <LazyImage
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover"
                />
            </div>

            <article className="prose prose-invert prose-lg max-w-none">
                <div
                    className="text-gray-300 leading-[1.8] text-xl md:text-2xl font-serif space-y-8 md:space-y-12"
                    dangerouslySetInnerHTML={{ __html: article.content || article.excerpt }}
                />
            </article>

            <Separator className="bg-white/5 my-24 md:my-32" />

            <footer className="text-center space-y-8 pb-24 md:pb-32">
                <h3 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-widest">{TEXTS.common.endOfDispatch}</h3>
                <p className="text-gray-500 font-medium">{TEXTS.common.stayTuned}</p>
                <Link to="/editorial">
                    <button className="mt-8 bg-white text-black px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary transition-all">
                        {TEXTS.common.exploreOtherArticles}
                    </button>
                </Link>
            </footer>
        </motion.div>
    );
}
