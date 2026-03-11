import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Activity, 
    TrendingUp, 
    Package, 
    Handshake, 
    Eye, 
    ArrowUpRight,
    TrendingDown,
    BarChart3,
    PieChart as PieIcon,
    LineChart as LineIcon,
    Disc,
    Music,
    PlayCircle,
    ChevronRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { analyticsService, type CommercialStats } from "@/services/analyticsService";
import { quotaService, type QuotaStats } from "@/services/quotaService";
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from "recharts";

export default function AdminStats() {
    const [comStats, setComStats] = useState<CommercialStats | null>(null);
    const [quotaStats, setQuotaStats] = useState<QuotaStats>(quotaService.getStats());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await analyticsService.getCommercialStats();
                setComStats(data);
            } catch (e) {
                console.error("Failed to load commercial stats:", e);
            } finally {
                setLoading(false);
            }
        };
        load();

        const handleQuotaUpdate = (e: any) => setQuotaStats(e.detail);
        window.addEventListener('obg_quota_update', handleQuotaUpdate);
        return () => window.removeEventListener('obg_quota_update', handleQuotaUpdate);
    }, []);

    if (loading || !comStats) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Cargando Telemetría Comercial...</p>
                </div>
            </div>
        );
    }

    const { 
        revenue, 
        capital, 
        activeNegotiations, 
        totalViews, 
        tradeDistribution, 
        revenueEvolution, 
        topItems 
    } = comStats;

    const ytPercent = Math.min((quotaStats.youtube / 10000) * 100, 100);

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            {/* Header: Visual Identity V23.0 */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-6xl font-display font-black text-white tracking-tightest uppercase italic leading-none">
                        OBG <span className="text-primary">Business</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-3">
                        <div className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-full">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Protocol V23.0-FULL</p>
                        </div>
                        <p className="text-zinc-500 font-bold uppercase tracking-tighter text-sm">Control de Mando y Analítica Predictiva</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                    <Activity className="h-4 w-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Live Feed Activo</span>
                </div>
            </header>

            {/* KPI Section: Tactical Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                    title="Ingresos Totales" 
                    value={`$${revenue.toLocaleString()}`} 
                    icon={TrendingUp} 
                    color="text-emerald-400" 
                    bg="bg-emerald-500/10"
                    trend="+12% vs last month"
                />
                <KPICard 
                    title="Capital en Batea" 
                    value={`$${capital.toLocaleString()}`} 
                    icon={Package} 
                    color="text-zinc-100" 
                    bg="bg-zinc-500/10"
                    trend="Stock Valuado"
                />
                <KPICard 
                    title="Negociaciones" 
                    value={activeNegotiations.toString()} 
                    icon={Handshake} 
                    color="text-orange-400" 
                    bg="bg-orange-500/10"
                    trend="Trades Activos"
                />
                <KPICard 
                    title="Vistas Totales" 
                    value={totalViews.toString()} 
                    icon={Eye} 
                    color="text-blue-400" 
                    bg="bg-blue-500/10"
                    trend="Tráfico de Archivo"
                />
            </div>

            {/* Charts Grid: Visual Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Evolution: Revenue vs Offers */}
                <Card className="bg-zinc-900/40 border-white/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                                <LineIcon className="h-4 w-4 text-primary" />
                                Evolución Comercial
                            </CardTitle>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Ingresos vs. Ofertas Diarias</p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueEvolution}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#666" 
                                    fontSize={10} 
                                    tickFormatter={(str) => str.split('-').slice(1).join('/')}
                                />
                                <YAxis stroke="#666" fontSize={10} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="offers" stroke="#f59e0b" fill="transparent" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Conversion Funnel / Status Distribution */}
                <Card className="bg-zinc-900/40 border-white/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                                <PieIcon className="h-4 w-4 text-orange-400" />
                                Embudo de Conversión
                            </CardTitle>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Estado de los Trades</p>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] flex flex-col md:flex-row items-center justify-around">
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tradeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="status"
                                    >
                                        {tradeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 w-full max-w-[150px]">
                            {tradeDistribution.map((item, i) => (
                                <div key={i} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{item.status}</span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-white">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Grid: Ranking & Technical Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Ranking: Top of Funnel */}
                 <Card className="bg-zinc-900/40 border-white/5 rounded-[2rem] overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-400" />
                            Ranking de Interés
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-4">
                            {topItems.map((item, i) => (
                                <div key={i} className="group relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-zinc-300 uppercase truncate pr-4">{item.name}</span>
                                        <span className="text-xs font-mono text-primary">{item.views} PV</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(item.views / topItems[0].views) * 100}%` }}
                                            className="h-full bg-gradient-to-r from-primary/50 to-primary"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Technical Health: Quota Status */}
                <Card className="bg-zinc-950/60 border-white/5 rounded-[2rem] overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500 uppercase">Estado de Infraestructura</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-2 gap-3">
                             <TechMetric icon={Disc} label="Discogs" value={quotaStats.discogs} sub="Unidades" />
                             <TechMetric icon={Music} label="Spotify" value={quotaStats.spotify} sub="Hits" pulse />
                         </div>
                         <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-end">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">YouTube Quota</p>
                                <p className="text-xs font-mono text-zinc-100">{quotaStats.youtube}/10000</p>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${ytPercent}%` }}
                                    className={`h-full ${ytPercent > 80 ? 'bg-red-500' : 'bg-red-500/50'}`}
                                />
                            </div>
                         </div>
                    </CardContent>
                </Card>
            </div>

            <footer className="mt-8 flex flex-col items-center gap-4">
                <div className="w-16 h-px bg-white/10" />
                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.5em]">
                    End-to-End Commerce Integration | OBG Tactical Intelligence
                </p>
            </footer>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, bg, trend }: any) {
    return (
        <Card className="bg-zinc-900/40 border-white/5 rounded-3xl overflow-hidden relative group hover:border-white/10 transition-all">
            <div className="p-6">
                <div className={`p-3 rounded-xl w-fit mb-4 ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{title}</p>
                    <p className={`text-3xl font-display font-black truncate ${color}`}>{value}</p>
                </div>
                <div className="mt-4 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-zinc-500" />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tight">{trend}</span>
                </div>
            </div>
            <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity`}>
                <Icon className={`h-16 w-16 text-white`} />
            </div>
        </Card>
    );
}

function TechMetric({ icon: Icon, label, value, sub, pulse }: any) {
    return (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-emerald-500 animate-ping' : 'bg-zinc-500'}`} />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-xl font-display font-black text-white">{value}</p>
                <p className="text-[8px] font-mono text-zinc-600 uppercase">{sub}</p>
            </div>
        </div>
    );
}
