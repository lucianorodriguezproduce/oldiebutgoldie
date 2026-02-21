import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp, where } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Activity, Globe, Search, ShoppingBag, PieChart, DollarSign, TrendingUp, BadgeDollarSign } from "lucide-react";

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

export default function AnalyticsDashboard() {
    const [events, setEvents] = useState<InteractionEvent[]>([]);
    const [stats, setStats] = useState({
        totalViews: 0,
        topCountries: {} as Record<string, number>,
        topCities: {} as Record<string, number>,
        recentSearches: [] as string[],
        activeOrdersCount: 0,
        buyIntent: 0,
        sellIntent: 0,
        potentialVolumeARS: 0,
        realVolumeARS: 0,
        facturacionPotencial: 0,
        facturacionReal: 0,
        ticketPromedio: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // Fetch last 100 interactions
                const q = query(
                    collection(db, "interactions"),
                    orderBy("timestamp", "desc"),
                    limit(100)
                );

                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as InteractionEvent));
                setEvents(data);

                // Process Stats
                const countries: Record<string, number> = {};
                const cities: Record<string, number> = {};
                const searches: string[] = [];
                let views = 0;

                data.forEach(e => {
                    // Count Views
                    if (e.action === "view" || e.action === "view_release" || e.action === "session_start") {
                        views++;
                    }

                    // Top Locations
                    if (e.location?.country) {
                        countries[e.location.country] = (countries[e.location.country] || 0) + 1;
                    }
                    if (e.location?.city) {
                        cities[e.location.city] = (cities[e.location.city] || 0) + 1;
                    }

                    // Recent Searches
                    if (e.action === "search" && e.metadata?.query) {
                        searches.push(e.metadata.query);
                    }
                });

                // Fetch Active Orders
                const ordersQuery = query(
                    collection(db, "orders"),
                    where("status", "in", ["pending", "quoted", "negotiating", "counteroffered", "pending_acceptance", "venta_finalizada", "contraoferta_usuario"]),
                    orderBy("timestamp", "desc")
                );
                const ordersSnap = await getDocs(ordersQuery);
                const activeOrders = ordersSnap.docs.map(d => d.data());

                let buyIntentCount = 0;
                let sellIntentCount = 0;
                activeOrders.forEach(o => {
                    if (o.type === 'buy' || o.details?.intent === "COMPRAR") buyIntentCount++;
                    if (o.type === 'sell' || o.details?.intent === "VENDER") sellIntentCount++;
                });

                setStats({
                    totalViews: views,
                    topCountries: countries,
                    topCities: cities,
                    recentSearches: [...new Set(searches)].slice(0, 10), // Unique, top 10
                    activeOrdersCount: activeOrders.length,
                    buyIntent: buyIntentCount,
                    sellIntent: sellIntentCount,
                    potentialVolumeARS: activeOrders.reduce((sum, o: any) => sum + (o.totalPrice || o.details?.price || 0), 0),
                    realVolumeARS: activeOrders.reduce((sum, o: any) => sum + (o.adminPrice || o.totalPrice || o.details?.price || 0), 0),
                    facturacionPotencial: activeOrders.reduce((sum, o: any) => sum + (o.adminPrice || o.totalPrice || o.details?.price || 0), 0),
                    facturacionReal: activeOrders.filter((o: any) => o.status === "venta_finalizada").reduce((sum, o: any) => sum + (o.adminPrice || o.totalPrice || o.details?.price || 0), 0),
                    ticketPromedio: activeOrders.length > 0
                        ? activeOrders.reduce((sum, o: any) => sum + (o.totalPrice || o.details?.price || 0), 0) / activeOrders.length
                        : 0
                });

            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    const getTop = (obj: Record<string, number>) => {
        return Object.entries(obj)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
    };

    if (loading) {
        return <div className="p-20 text-center text-gray-500 font-mono animate-pulse">ESTABLISHING UPLINK...</div>;
    }

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">
                    Global <span className="text-primary">Intelligence</span>
                </h1>
                <p className="text-gray-500 mt-4 text-lg font-medium">Real-time telemetry and user interaction signals.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full" />
                    <div className="flex items-center gap-4 mb-4">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Active Orders</h3>
                    </div>
                    <p className="text-5xl font-black text-white">{stats.activeOrdersCount}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">In Pipeline</p>
                </Card>

                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[60px] rounded-full" />
                    <div className="flex items-center gap-4 mb-4">
                        <DollarSign className="h-6 w-6 text-orange-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Volumen Potencial</h3>
                    </div>
                    <p className="text-4xl font-black text-white">$ {stats.potentialVolumeARS.toLocaleString()}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Ofertas Usuarios</p>
                </Card>

                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full" />
                    <div className="flex items-center gap-4 mb-4">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ventas Confirmadas</h3>
                    </div>
                    <p className="text-4xl font-black text-white">$ {stats.facturacionReal.toLocaleString()}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Estado: venta_finalizada</p>
                </Card>

                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full" />
                    <div className="flex items-center gap-4 mb-4">
                        <BadgeDollarSign className="h-6 w-6 text-purple-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ticket Promedio</h3>
                    </div>
                    <p className="text-4xl font-black text-white">$ {stats.ticketPromedio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Valor medio por lote</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <PieChart className="h-6 w-6 text-primary" /> Intención de Mercado (Buy vs Sell)
                    </h3>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-6">
                        {stats.activeOrdersCount > 0 ? (
                            <>
                                <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider">
                                    <span className="text-green-400">Total Compra: {stats.buyIntent}</span>
                                    <span className="text-orange-400">Total Venta: {stats.sellIntent}</span>
                                </div>
                                <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-1000 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                        style={{ width: `${(stats.buyIntent / stats.activeOrdersCount) * 100}%` }}
                                    />
                                    <div
                                        className="h-full bg-orange-500 transition-all duration-1000 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                        style={{ width: `${(stats.sellIntent / stats.activeOrdersCount) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-center text-gray-500 font-bold uppercase tracking-widest">
                                    Proporción de mercado basada en órdenes activas
                                </p>
                            </>
                        ) : (
                            <p className="text-gray-600 text-center py-4">No active orders to analyze.</p>
                        )}
                    </div>

                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <MapPin className="h-6 w-6 text-blue-400" /> Top Locations
                    </h3>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-6">
                        {getTop(stats.topCountries).map(([country, count], i) => (
                            <div key={country} className="flex items-center justify-between">
                                <span className="flex items-center gap-4">
                                    <span className="text-gray-600 font-mono text-xs">0{i + 1}</span>
                                    <span className="text-lg font-bold text-white">{country}</span>
                                </span>
                                <Badge className="bg-white/5 text-primary border-white/5 font-mono">{count} signals</Badge>
                            </div>
                        ))}
                        {Object.keys(stats.topCountries).length === 0 && (
                            <p className="text-gray-600 text-center py-10">No geolocation data available yet.</p>
                        )}
                    </div>
                </div>

                <div className="space-y-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Search className="h-6 w-6 text-green-400" /> Search Trends
                    </h3>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-4">
                        {(stats.recentSearches || []).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {stats.recentSearches.map((query, i) => (
                                    <Badge key={i} className="bg-green-500/10 text-green-400 border-green-500/20 px-3 py-1.5 text-xs">
                                        {query}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600 text-center py-4">No recent searches.</p>
                        )}
                    </div>

                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Activity className="h-6 w-6 text-purple-400" /> Recent Feed
                    </h3>
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {events.map((event) => (
                            <div key={event.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${event.action === 'search' ? 'bg-blue-500' :
                                    event.action === 'view_release' ? 'bg-primary' :
                                        'bg-gray-500'
                                    }`} />
                                <div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider mb-1">{event.action.replace('_', ' ')}</p>
                                    <p className="text-xs text-gray-500 font-mono mb-2">
                                        {event.location?.city}, {event.location?.country}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {event.metadata && Object.entries(event.metadata).map(([k, v]) => (
                                            <Badge key={k} variant="secondary" className="bg-black text-[9px] text-gray-400 border border-white/10">
                                                {k}: {String(v).substring(0, 20)}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <span className="ml-auto text-[10px] text-gray-600 font-mono whitespace-nowrap">
                                    {event.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
