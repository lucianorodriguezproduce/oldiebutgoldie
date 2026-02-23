import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Mic, Activity } from 'lucide-react';
import { getEventosChatSession } from '@/lib/gemini';
import { TEXTS } from '@/constants/texts';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export default function Eventos() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatSession, setChatSession] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize Chat
    useEffect(() => {
        const initChat = () => {
            const session = getEventosChatSession();
            setChatSession(session);

            // Add a welcome message if the session started successfully
            if (session && messages.length === 0) {
                setMessages([
                    {
                        id: 'welcome',
                        role: 'model',
                        text: TEXTS.common.events.welcome
                    }
                ]);
            } else if (!session && messages.length === 0) {
                setMessages([
                    {
                        id: 'error',
                        role: 'model',
                        text: TEXTS.common.events.connectionError
                    }
                ]);
            }
        };

        initChat();
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const trimmed = input.trim();
        if (!trimmed || !chatSession || isLoading) return;

        // Optimistic UI update
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chatSession.sendMessage(trimmed);
            const responseText = result.response.text();

            const modelMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: responseText
            };

            setMessages(prev => [...prev, modelMsg]);
        } catch (error) {
            console.error('Error sending message to AI:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: TEXTS.common.events.interference
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            // Refocus input on desktop, might cause keyboard jump on mobile so keeping it simple
            if (window.innerWidth > 768) {
                inputRef.current?.focus();
            }
        }
    };

    const handleClearChat = () => {
        if (!window.confirm(TEXTS.common.events.purgeConfirm)) return;

        const newSession = getEventosChatSession();
        setChatSession(newSession);
        setMessages([
            {
                id: Date.now().toString(),
                role: 'model',
                text: TEXTS.common.events.reset
            }
        ]);
        setInput('');
    };

    // Helper to render bold markdown as simply strong text (simple parser for the chat)
    const renderMarkdownContent = (text: string) => {
        // Very basic bold parser (**text**)
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#050505] font-sans overflow-hidden w-full m-0 p-0 fixed inset-0">
            {/* Minimalist Dark Header */}
            <header className="flex-none pt-[env(safe-area-inset-top,1.5rem)] pb-4 px-6 border-b border-white/10 bg-[#050505] z-10 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                        <Activity className="w-4 h-4 text-primary relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-display font-black text-white uppercase tracking-tighter leading-none">{TEXTS.common.events.title}</h1>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mt-1">{TEXTS.common.events.subtitle}</p>
                    </div>
                </div>

                <button
                    onClick={handleClearChat}
                    className="h-10 w-10 flex items-center justify-center rounded-full text-gray-500 hover:text-red-500 hover:bg-white/5 transition-colors active:scale-90"
                    title={TEXTS.common.events.clearChat}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </header>

            {/* Chat History Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 overscroll-contain pb-32">
                <div className="max-w-3xl mx-auto space-y-6">
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] md:max-w-[75%] rounded-[2rem] px-5 py-4 ${msg.role === 'user'
                                        ? 'bg-primary text-black rounded-br-sm'
                                        : 'bg-[#111111] border border-white/5 text-gray-300 rounded-bl-sm shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
                                        }`}
                                >
                                    <p className={`text-sm md:text-base leading-relaxed ${msg.role === 'user' ? 'font-medium' : 'font-mono'}`}>
                                        {renderMarkdownContent(msg.text)}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start w-full"
                        >
                            <div className="bg-[#111111] border border-white/5 rounded-[2rem] rounded-bl-sm px-6 py-5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* Input Area */}
            <div className="flex-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pt-10 pb-[env(safe-area-inset-bottom,1.5rem)] px-4 md:px-8">
                <div className="max-w-3xl mx-auto relative">
                    <form
                        onSubmit={handleSendMessage}
                        className="relative flex items-center bg-[#111] border-2 border-white/10 rounded-full focus-within:border-primary/50 transition-colors shadow-2xl overflow-hidden"
                    >
                        <div className="pl-6 text-gray-500">
                            <Mic className="w-5 h-5" />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={TEXTS.common.events.inputPlaceholder}
                            className="flex-1 bg-transparent py-5 px-4 text-white text-sm md:text-base focus:outline-none font-mono placeholder:font-sans placeholder:text-gray-600"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="h-12 w-12 mr-2 rounded-full bg-primary hover:bg-white text-black flex items-center justify-center transition-all disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500 flex-shrink-0"
                        >
                            <Send className="w-5 h-5 ml-1" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
