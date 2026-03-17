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
    ChevronRight,
    ShieldAlert,
    Sparkles,
    Loader2,
    Trash2,
    Database,
    MousePointerClick,
    Search,
    Clock,
    LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { analyticsService, type CommercialStats } from "@/services/analyticsService";
import { quotaService, type QuotaStats } from "@/services/quotaService";
import { maintenanceService } from "@/services/maintenanceService";
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
    const { user } = useAuth();
    const [comStats, setComStats] = useState<CommercialStats | null>(null);
    const [quotaStats, setQuotaStats] = useState<QuotaStats>(quotaService.getStats());
    const [loading, setLoading] = useState(true);
    const [isPurging, setIsPurging] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let isMounted = true;
        
        // Safety timeout: forcedly stop loading after 5 seconds
        const timer = setTimeout(() => {
            if (isMounted && loading) {
                console.warn("[AdminStats] Telemetry load timeout reached.");
                setLoading(false);
            }
        }, 5000);

        const load = async () => {
            try {
                const data = await analyticsService.getCommercialStats();
                if (isMounted) {
                    setComStats(data);
                    setLoading(false);
                }
            } catch (e) {
                console.error("Failed to load commercial stats:", e);
                if (isMounted) setLoading(false);
            }
        };


        load();

        const handleQuotaUpdate = (e: any) => {
            if (isMounted) setQuotaStats(e.detail);
        };
        window.addEventListener('obg_quota_update', handleQuotaUpdate);
        
        return () => {
            isMounted = false;
            clearTimeout(timer);
            window.removeEventListener('obg_quota_update', handleQuotaUpdate);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Cargando Telemetría Comercial...</p>
                </div>
            </div>
        );
    }

    const stats = comStats || { 
        revenue: 0, 
        capital: 0, 
        activeNegotiations: 0, 
        totalViews: 0, 
        tradeDistribution: [], 
        revenueEvolution: [], 
        topItems: [] 
    };

    const { 
        revenue, 
        capital, 
        activeNegotiations, 
        totalViews, 
        tradeDistribution, 
        revenueEvolution, 
        topItems 
    } = stats;

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
                <div className="flex flex-col md:flex-row items-center gap-2">
                    <div className="flex items-center gap-2 text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="text-[9px] font-mono opacity-50">{user?.uid}</span>
                        <span className="text-[9px] font-black uppercase text-zinc-400">{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                        <Activity className="h-4 w-4 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Live Feed Activo</span>
                    </div>
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

            {/* System Maintenance Section (Protocol V36.0 Integration) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-8 mt-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-red-500/10 rounded-xl">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-black text-white uppercase italic tracking-tighter">Mantenimiento Global</h2>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">Consistencia de Identidad y Purga de Datos</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Analytics Purge */}
                    <div className="flex flex-col gap-4 p-5 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 text-white">
                            <MousePointerClick className="w-4 h-4 text-primary" />
                            <span className="text-xs font-black uppercase tracking-widest">Analiticas</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium">Elimina registros de visualizaciones antiguas (&gt;30d).</p>
                        <button
                            onClick={async () => {
                                setIsPurging(prev => ({ ...prev, analytics: true }));
                                const count = await maintenanceService.purgeAnalyticsIntents();
                                alert(`Purga completada: ${count} registros eliminados.`);
                                setIsPurging(prev => ({ ...prev, analytics: false }));
                            }}
                            disabled={isPurging.analytics}
                            className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest text-white rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            {isPurging.analytics ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Purgar Analíticas
                        </button>
                    </div>

                    {/* Notifications Purge */}
                    <div className="flex flex-col gap-4 p-5 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 text-white">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-xs font-black uppercase tracking-widest">Notificaciones</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium">Borra notificaciones antiguas y leídas.</p>
                        <button
                            onClick={async () => {
                                setIsPurging(prev => ({ ...prev, notif: true }));
                                const count = await maintenanceService.purgeNotifications();
                                alert(`Limpieza realizada: ${count} notificaciones purgadas.`);
                                setIsPurging(prev => ({ ...prev, notif: false }));
                            }}
                            disabled={isPurging.notif}
                            className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest text-white rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            {isPurging.notif ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Limpiar Alertas
                        </button>
                    </div>

                    {/* Inventory Archiving */}
                    <div className="flex flex-col gap-4 p-5 bg-black/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 text-white">
                            <Database className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-widest">Inventario</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium">Archiva discos sin stock sin actividad reciente.</p>
                        <button
                            onClick={async () => {
                                setIsPurging(prev => ({ ...prev, inv: true }));
                                const count = await maintenanceService.archiveSoldOutItems();
                                alert(`Mantenimiento: ${count} discos movidos al archivo.`);
                                setIsPurging(prev => ({ ...prev, inv: false }));
                            }}
                            disabled={isPurging.inv}
                            className="mt-auto px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest text-white rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            {isPurging.inv ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                            Archivar Agotados
                        </button>
                    </div>

                    {/* Chat Identity Healing (Protocol V36.0) */}
                    <div className="flex flex-col gap-4 p-5 bg-primary/5 border border-primary/20 rounded-2xl hover:border-primary/40 transition-colors">
                        <div className="flex items-center gap-3 text-primary">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Chat Healing</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-medium">Repara identidades de chat corruptas (Protocolo V36.0).</p>
                        <button
                            onClick={async () => {
                                if (!confirm("¿Iniciar curación profunda V36.2?")) return;
                                setIsPurging(prev => ({ ...prev, heal: true }));
                                try {
                                    const result = await maintenanceService.healConversationIdentities();
                                    alert(`Reporte de Curación: ${result}`);
                                } catch (error: any) {
                                    console.error("[Heal-UI] Fatal error during healing:", error);
                                    alert(`ERROR FATAL: ${error.message}`);
                                } finally {
                                    setIsPurging(prev => ({ ...prev, heal: false }));
                                }
                            }}
                            disabled={isPurging.heal}
                            className="mt-auto px-4 py-2.5 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest text-primary rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            {isPurging.heal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Curar Identidades
                        </button>
                    </div>
                </div>
            </motion.div>

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
