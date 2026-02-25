import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp, where } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    MapPin, Activity, Globe, Search, ShoppingBag, PieChart,
    DollarSign, TrendingUp, BadgeDollarSign, UploadCloud,
    Users, Clock, ArrowUpRight, BarChart3, LineChart
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLoading } from "@/context/LoadingContext";
import { TEXTS } from "@/constants/texts";
import { motion, AnimatePresence } from "framer-motion";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from "recharts";
import { runReport } from "@/services/analyticsService";
import type { AnalyticsDataPoint } from "@/services/analyticsService";
import { gscService } from "@/services/gscService";

interface InteractionEvent {
    id: string;
    action: string;
    location?: {
        city?: string;
        country?: string;
        region?: string;
    };
    metadata?: any;
    timestamp?: Timestamp;
    path?: string;
}

interface SearchConsoleData {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

export default function AdminAnalytics() {
    const { showLoading, hideLoading } = useLoading();
    const [activeTab, setActiveTab] = useState<'business' | 'traffic'>('business');

    // Business Stats
    const [events, setEvents] = useState<InteractionEvent[]>([]);
    const [businessStats, setBusinessStats] = useState({
        totalViews: 0,
        topCountries: {} as Record<string, number>,
        activeOrdersCount: 0,
        buyIntent: 0,
        sellIntent: 0,
        potentialVolumeARS: 0,
        facturacionReal: 0,
        ticketPromedio: 0,
        recentSearches: [] as string[]
    });

    // Traffic Stats
    const [chartData, setChartData] = useState<AnalyticsDataPoint[]>([]);
    const [keywords, setKeywords] = useState<SearchConsoleData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
    const [isTrafficLoading, setIsTrafficLoading] = useState(true);
    const [isKeywordsLoading, setIsKeywordsLoading] = useState(true);
    const [needsGSCAuth, setNeedsGSCAuth] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            showLoading("Compilando Inteligencia Unificada...");
            try {
                // 1. Fetch Firestore Business Data
                const interReq = query(collection(db, "interactions"), orderBy("timestamp", "desc"), limit(100));
                const interSnap = await getDocs(interReq);
                const interData = interSnap.docs.map(d => ({ id: d.id, ...d.data() } as InteractionEvent));
                setEvents(interData);

                const ordersReq = query(
                    collection(db, "orders"),
                    where("status", "in", ["pending", "quoted", "negotiating", "counteroffered", "venta_finalizada", "contraoferta_usuario"]),
                    orderBy("timestamp", "desc")
                );
                const ordersSnap = await getDocs(ordersReq);
                const activeOrders = ordersSnap.docs.map(d => d.data());

                // Process Business Metrics
                const countries: Record<string, number> = {};
                const searches: string[] = [];
                let views = 0;
                let buyCount = 0;
                let sellCount = 0;

                interData.forEach(e => {
                    if (e.action === "view" || e.action === "view_release") views++;
                    if (e.location?.country) countries[e.location.country] = (countries[e.location.country] || 0) + 1;
                    if (e.action === "search" && e.metadata?.query) searches.push(e.metadata.query);
                });

                activeOrders.forEach(o => {
                    if (o.type === 'buy' || o.details?.intent === "COMPRAR") buyCount++;
                    if (o.type === 'sell' || o.details?.intent === "VENDER") sellCount++;
                });

                setBusinessStats({
                    totalViews: views,
                    topCountries: countries,
                    activeOrdersCount: activeOrders.length,
                    buyIntent: buyCount,
                    sellIntent: sellCount,
                    potentialVolumeARS: activeOrders.reduce((sum, o: any) => sum + (o.totalPrice || o.details?.price || 0), 0),
                    facturacionReal: activeOrders.filter((o: any) => o.status === "venta_finalizada").reduce((sum, o: any) => sum + (o.adminPrice || o.totalPrice || o.details?.price || 0), 0),
                    ticketPromedio: activeOrders.length > 0 ? activeOrders.reduce((sum, o: any) => sum + (o.totalPrice || o.details?.price || 0), 0) / activeOrders.length : 0,
                    recentSearches: [...new Set(searches)].slice(0, 10)
                });

                // 2. Fetch GA4 Traffic Data
                setIsTrafficLoading(true);
                const gaData = await runReport();
                setChartData(gaData);

                // REAL GSC DATA: Fetch from bridge
                const gscResult = await gscService.getKeywords();
                if (gscResult.needs_auth) {
                    setNeedsGSCAuth(true);
                    setKeywords([]);
                } else {
                    setKeywords(gscResult.data || []);
                }
                setIsKeywordsLoading(false);

            } catch (error) {
                console.error("Critical Analytics Error:", error);
            } finally {
                setIsTrafficLoading(false);
                hideLoading();
            }
        };

        fetchAllData();
    }, []);

    const filteredKeywords = useMemo(() => {
        return keywords.filter(kw => kw.query.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [keywords, searchTerm]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-display font-black text-white tracking-tightest uppercase italic">
                        Stitch <span className="text-primary">Intelligence</span>
                    </h1>
                    <p className="text-gray-500 mt-2 font-bold uppercase tracking-widest text-sm">Central de Telemetría y Control de Mercado</p>
                </div>

                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
                    <button
                        onClick={() => setActiveTab('business')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'business' ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'}`}
                    >
                        Negocio
                    </button>
                    <button
                        onClick={() => setActiveTab('traffic')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'traffic' ? 'bg-primary text-black' : 'text-gray-500 hover:text-white'}`}
                    >
                        Tráfico
                    </button>
                </div>
            </header>

            <AnimatePresence mode="wait">
                {activeTab === 'business' ? (
                    <motion.div
                        key="business"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-12"
                    >
                        {/* Business KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <KPIBlock icon={ShoppingBag} label="Órdenes Activas" value={businessStats.activeOrdersCount} sub="En Pipeline" color="primary" />
                            <KPIBlock icon={DollarSign} label="Volumen Potencial" value={`$ ${businessStats.potentialVolumeARS.toLocaleString()}`} sub="Ofertas Usuarios" color="orange-400" />
                            <KPIBlock icon={TrendingUp} label="Ventas Confirmadas" value={`$ ${businessStats.facturacionReal.toLocaleString()}`} sub="venta_finalizada" color="primary" />
                            <KPIBlock icon={BadgeDollarSign} label="Ticket Promedio" value={`$ ${businessStats.ticketPromedio.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="Media por lote" color="purple-400" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <PieChart className="h-5 w-5 text-primary" /> Intención de Mercado (Buy vs Sell)
                                </h3>
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-green-400">Total Compra: {businessStats.buyIntent}</span>
                                        <span className="text-orange-400">Total Venta: {businessStats.sellIntent}</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-1000"
                                            style={{ width: `${(businessStats.buyIntent / (businessStats.activeOrdersCount || 1)) * 100}%` }}
                                        />
                                        <div
                                            className="h-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all duration-1000"
                                            style={{ width: `${(businessStats.sellIntent / (businessStats.activeOrdersCount || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <MapPin className="h-5 w-5 text-blue-400" /> Top Radiación Geográfica
                                </h3>
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-4">
                                    {Object.entries(businessStats.topCountries).sort(([, a], [, b]) => b - a).slice(0, 5).map(([country, count], i) => (
                                        <div key={country} className="flex items-center justify-between">
                                            <span className="flex items-center gap-4">
                                                <span className="text-gray-600 font-mono text-[10px]">0{i + 1}</span>
                                                <span className="text-sm font-bold text-white uppercase">{country}</span>
                                            </span>
                                            <Badge className="bg-white/5 text-primary border-white/5 font-mono text-[10px]">{count} signals</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <Activity className="h-5 w-5 text-purple-400" /> Feed de Señales Recientes
                                </h3>
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 h-[500px] overflow-y-auto custom-scrollbar space-y-4">
                                    {events.map((event) => (
                                        <div key={event.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 group">
                                            <div className={`w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0 ${event.action === 'search' ? 'bg-blue-500' : 'bg-primary'}`} />
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{(event.action || "signal").replace('_', ' ')}</p>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">{event.location?.city || "Unknown"}, {event.location?.country || "Localhost"}</p>
                                            </div>
                                            <span className="text-[9px] text-gray-600 font-mono">
                                                {event.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="traffic"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-12"
                    >
                        {/* Traffic Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <KPIBlock icon={Users} label="Active Now" value="24" sub="Conexiones vivas" color="emerald-400" />
                            <KPIBlock icon={Activity} label="Traffic Flow" value={isTrafficLoading ? '-' : chartData.reduce((acc, curr) => acc + curr.sessions, 0).toLocaleString()} sub="Sesiones (7d)" color="blue-400" />
                            <KPIBlock icon={Clock} label="Retention" value="--" sub="Conectando API..." color="orange-400" />
                            <KPIBlock icon={TrendingUp} label="Conversion" value="--" sub="Tasa de Cierre" color="purple-400" />
                        </div>

                        {/* Volume Chart */}
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8">
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center justify-between">
                                <span>Volumen de Visitantes (GA4 Hub)</span>
                                {selectedKeyword && (
                                    <Badge className="bg-primary/10 text-primary border-primary/20">Ref: "{selectedKeyword}"</Badge>
                                )}
                            </h2>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#444', fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #222', borderRadius: '12px' }} />
                                        <Area type="monotone" dataKey="sessions" stroke="#8884d8" strokeWidth={4} fillOpacity={1} fill="url(#colorTraffic)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Keyword Table */}
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
                            <div className="p-8 border-b border-white/5 bg-black/40 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <LineChart className="w-5 h-5 text-primary" /> Dominant Keywords
                                </h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search query..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-primary/50 w-64"
                                    />
                                </div>
                            </div>
                            {needsGSCAuth && (
                                <div className="p-8 pt-0">
                                    <button
                                        onClick={() => gscService.connect()}
                                        className="px-4 py-2 bg-primary/20 border border-primary/40 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/30 transition-all rounded-sm flex items-center gap-2"
                                    >
                                        <Search className="w-3 h-3" />
                                        Connect Search Console
                                    </button>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                        <tr>
                                            <th className="p-6">Query</th>
                                            <th className="p-6">Clicks</th>
                                            <th className="p-6">Impressions</th>
                                            <th className="p-6">CTR</th>
                                            <th className="p-6">Pos</th>
                                            <th className="p-6">Insight</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {filteredKeywords.length > 0 ? (
                                            filteredKeywords.map((kw, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setSelectedKeyword(kw.query)}>
                                                    <td className="p-6 font-bold text-white group-hover:text-primary transition-colors uppercase">{kw.query}</td>
                                                    <td className="p-6 text-primary font-mono">{kw.clicks}</td>
                                                    <td className="p-6 text-blue-400 font-mono">{kw.impressions.toLocaleString()}</td>
                                                    <td className="p-6 text-green-400 font-mono">{kw.ctr.toFixed(1)}%</td>
                                                    <td className="p-6 text-purple-400 font-mono">#{kw.position.toFixed(1)}</td>
                                                    <td className="p-6">
                                                        {kw.ctr < 3 && kw.impressions > 100 && (
                                                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px] uppercase font-black px-2 py-0.5 animate-pulse">
                                                                Editorial Opp
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                                                    {isKeywordsLoading ? "Sincronizando con Search Console..." : "Sin datos de búsqueda disponibles"}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function KPIBlock({ icon: Icon, label, value, sub, color }: any) {
    return (
        <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-white/10 transition-all">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}/5 blur-[60px] rounded-full group-hover:bg-${color}/10 transition-all`} />
            <div className="flex items-center gap-4 mb-4">
                <Icon className={`h-5 w-5 text-${color}`} />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</h3>
            </div>
            <p className="text-4xl font-black text-white tracking-tighter">{value}</p>
            <p className="text-[10px] text-gray-600 mt-2 font-black uppercase tracking-widest">{sub}</p>
        </Card>
    );
}
