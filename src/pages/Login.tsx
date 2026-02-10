import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Disc, Mail, Github, Chrome, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            navigate("/");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Authentication failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate("/");
        } catch (err: any) {
            console.error(err);
            setError("Google Sign-In failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-3xl p-8 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -mr-10 -mt-10" />

                    <CardHeader className="text-center pb-8">
                        <motion.div
                            initial={{ rotate: -180, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", damping: 10, stiffness: 50 }}
                            className="flex justify-center mb-6"
                        >
                            <div className="p-4 bg-primary rounded-2xl shadow-xl shadow-primary/20">
                                <Disc className="h-10 w-10 text-black" />
                            </div>
                        </motion.div>
                        <CardTitle className="text-4xl font-display font-bold text-white tracking-tightest mb-2">
                            {isLogin ? "Welcome Back" : "Create Account"}
                        </CardTitle>
                        <CardDescription className="text-gray-500 font-medium">
                            {isLogin
                                ? "Access your sonic archive and marketplace data."
                                : "Join the global community of vinyl collectors."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="email"
                                        placeholder="your@email.com"
                                        className="pl-12 bg-black/40 border-white/5 h-14 rounded-xl text-white focus-visible:ring-primary"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="bg-black/40 border-white/5 h-14 rounded-xl text-white focus-visible:ring-primary px-6"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <AnimatePresence>
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="text-red-400 text-xs font-bold text-center bg-red-400/10 p-3 rounded-lg border border-red-400/20"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </AnimatePresence>

                            <Button
                                type="submit"
                                className="w-full h-16 bg-primary text-black hover:bg-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-primary/10 group"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? "Synchronize" : "Initialize"}
                                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/5" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0c0c0c] px-4 text-gray-600 font-black tracking-widest">Protocol</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-14 bg-black/40 border-white/5 hover:bg-white/5 text-white rounded-xl font-bold gap-3"
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                            >
                                <Chrome className="h-4 w-4" /> Google
                            </Button>
                            <Button
                                variant="outline"
                                className="h-14 bg-black/40 border-white/5 hover:bg-white/5 text-white rounded-xl font-bold gap-3"
                                disabled={true} // Placeholder for Github
                            >
                                <Github className="h-4 w-4" /> Github
                            </Button>
                        </div>

                        <p className="text-center text-xs text-gray-600 font-medium">
                            {isLogin ? "Don't have an archive identifier?" : "Already participating in the collective?"}{" "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary hover:underline font-bold transition-all underline-offset-4"
                            >
                                {isLogin ? "Create Index" : "Login Signal"}
                            </button>
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
