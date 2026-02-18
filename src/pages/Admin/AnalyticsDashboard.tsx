import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Activity, Globe, Search } from "lucide-react";

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
        recentSearches: [] as string[]
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

                setStats({
                    totalViews: views,
                    topCountries: countries,
                    topCities: cities,
                    recentSearches: [...new Set(searches)].slice(0, 10) // Unique, top 10
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full" />
                    <div className="flex items-center gap-4 mb-4">
                        <Activity className="h-6 w-6 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Interactions</h3>
                    </div>
                    <p className="text-5xl font-black text-white">{events.length}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Last 100 events</p>
                </Card>

                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex items-center gap-4 mb-4">
                        <Globe className="h-6 w-6 text-blue-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Active Regions</h3>
                    </div>
                    <p className="text-5xl font-black text-white">{Object.keys(stats.topCountries).length}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Unique Countries</p>
                </Card>

                <Card className="bg-white/[0.03] border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex items-center gap-4 mb-4">
                        <Search className="h-6 w-6 text-green-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Search Velocity</h3>
                    </div>
                    <p className="text-5xl font-black text-white">{stats.recentSearches.length}</p>
                    <p className="text-xs text-gray-600 mt-2 font-bold uppercase tracking-widest">Unique Queries</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <MapPin className="h-6 w-6 text-primary" /> Top Locations
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
                        <Activity className="h-6 w-6 text-primary" /> Recent Feed
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
