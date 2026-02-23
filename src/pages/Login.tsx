import { useState, type FormEvent } from "react";
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
import { useLoading } from "@/context/LoadingContext";
import { useEffect } from "react";
import { TEXTS } from "@/constants/texts";

export default function Login() {
    const { showLoading, hideLoading } = useLoading();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();

        if (!isLogin && password.length < 6) {
            setError(TEXTS.common.auth.passwordTooShort);
            return;
        }

        showLoading(isLogin ? TEXTS.common.auth.syncArchive : TEXTS.common.auth.initProtocol);
        setLoading(true);
        setError(null);
        try {
            const userCredential = isLogin
                ? await signInWithEmailAndPassword(auth, email, password)
                : await createUserWithEmailAndPassword(auth, email, password);

            if (userCredential.user.email === "admin@discography.ai") {
                navigate("/admin");
            } else {
                navigate("/");
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === "auth/invalid-credential") {
                setError(TEXTS.common.auth.invalidCredentials);
            } else if (err.code === "auth/weak-password") {
                setError(TEXTS.common.auth.weakPassword);
            } else if (err.code === "auth/unauthorized-domain") {
                setError(TEXTS.common.auth.unauthorizedDomain);
            } else {
                setError(err.message || TEXTS.common.auth.authFailed);
            }
        } finally {
            setLoading(false);
            hideLoading();
        }
    };

    const handleGoogleSignIn = async () => {
        showLoading(TEXTS.common.auth.syncGoogle);
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            if (result.user.email === "admin@discography.ai") {
                navigate("/admin");
            } else {
                navigate("/");
            }
        } catch (err: any) {
            console.error(err);
            setError(TEXTS.common.auth.googleSignInFailed);
        } finally {
            setLoading(false);
            hideLoading();
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
                            {isLogin ? TEXTS.common.auth.welcomeBack : TEXTS.common.auth.createAccount}
                        </CardTitle>
                        <CardDescription className="text-gray-500 font-medium">
                            {isLogin
                                ? TEXTS.common.auth.accessArchive
                                : TEXTS.common.auth.joinCommunity}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="email-input" className="sr-only">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="email-input"
                                        name="email"
                                        type="email"
                                        placeholder={TEXTS.common.auth.emailPlaceholder}
                                        className="pl-12 bg-black/40 border-white/5 h-14 rounded-xl text-white focus-visible:ring-primary"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="password-input" className="sr-only">Password</label>
                                <Input
                                    id="password-input"
                                    name="password"
                                    type="password"
                                    placeholder={TEXTS.common.auth.passwordPlaceholder}
                                    className="bg-black/40 border-white/5 h-14 rounded-xl text-white focus-visible:ring-primary px-6"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete={isLogin ? "current-password" : "new-password"}
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
                                {isLogin ? TEXTS.common.auth.synchronize : TEXTS.common.auth.initialize}
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/5" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0c0c0c] px-4 text-gray-600 font-black tracking-widest">{TEXTS.common.auth.protocol}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-14 bg-black/40 border-white/5 hover:bg-white/5 text-white rounded-xl font-bold gap-3"
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                            >
                                <Chrome className="h-4 w-4" /> {TEXTS.common.auth.google}
                            </Button>
                            <Button
                                variant="outline"
                                className="h-14 bg-black/40 border-white/5 hover:bg-white/5 text-white rounded-xl font-bold gap-3"
                                disabled={true} // Placeholder for Github
                            >
                                <Github className="h-4 w-4" /> {TEXTS.common.auth.github}
                            </Button>
                        </div>

                        <p className="text-center text-xs text-gray-600 font-medium">
                            {isLogin ? TEXTS.common.auth.noAccount : TEXTS.common.auth.hasAccount}{" "}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary hover:underline font-bold transition-all underline-offset-4"
                            >
                                {isLogin ? TEXTS.common.auth.createIndex : TEXTS.common.auth.loginSignal}
                            </button>
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
