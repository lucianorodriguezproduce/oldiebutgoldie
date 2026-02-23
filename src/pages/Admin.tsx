import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, TrendingUp, Archive } from "lucide-react";
import { TEXTS } from "@/constants/texts";

export default function Admin() {
    // Analytics & Telemetry is active globally
    // Fetch stats from Firestore
    const { data: stats, isLoading } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => {
            const interactions = await getDocs(query(collection(db, "interactions"), orderBy("timestamp", "desc"), limit(100)));
            const leads = await getDocs(collection(db, "leads"));

            const docs = interactions.docs.map(d => d.data());
            const uniqueIps = new Set(docs.map(d => d.location?.ip)).size;
            const topCities = docs.reduce((acc: any, curr: any) => {
                const city = curr.location?.city || "Unknown";
                acc[city] = (acc[city] || 0) + 1;
                return acc;
            }, {});

            return {
                totalInteractions: interactions.size,
                uniqueVisitors: uniqueIps,
                totalLeads: leads.size,
                topCities: Object.entries(topCities).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)
            };
        }
    });

    return (
        <div className="space-y-10 p-6">
            <header>
                <h1 className="text-5xl font-display font-black text-white tracking-tightest">
                    {TEXTS.common.adminDashboard.title.split(' ').slice(0, -1).join(' ')} <span className="text-primary">{TEXTS.common.adminDashboard.title.split(' ').slice(-1)}</span>
                </h1>
                <p className="text-gray-500 mt-2 font-medium">{TEXTS.common.adminDashboard.description}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    title={TEXTS.common.adminDashboard.liveInteractions}
                    value={stats?.totalInteractions || 0}
                    icon={<TrendingUp className="text-primary h-5 w-5" />}
                    loading={isLoading}
                />
                <StatCard
                    title={TEXTS.common.adminDashboard.uniqueSpectators}
                    value={stats?.uniqueVisitors || 0}
                    icon={<Users className="text-secondary h-5 w-5" />}
                    loading={isLoading}
                />
                <StatCard
                    title={TEXTS.common.adminDashboard.argentinaLeads}
                    value={stats?.totalLeads || 0}
                    icon={<Archive className="text-blue-400 h-5 w-5" />}
                    loading={isLoading}
                />
                <StatCard
                    title={TEXTS.common.adminDashboard.targetRegions}
                    value={stats?.topCities?.length || 0}
                    icon={<MapPin className="text-orange-400 h-5 w-5" />}
                    loading={isLoading}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 border-b border-white/5">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <MapPin className="h-6 w-6 text-primary" />
                            {TEXTS.common.adminDashboard.geographicHotspots}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {stats?.topCities.map(([city, count]: any) => (
                            <div key={city} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {city[0]}
                                    </div>
                                    <span className="text-gray-300 font-bold group-hover:text-white transition-colors">{city}</span>
                                </div>
                                <span className="text-gray-600 font-black">{count} {TEXTS.common.adminDashboard.hits}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border border-primary/20 backdrop-blur-3xl rounded-[2.5rem] p-10 flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 bg-primary rounded-3xl shadow-2xl shadow-primary/20 flex items-center justify-center mb-6">
                        <Archive className="text-black h-10 w-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">{TEXTS.common.adminDashboard.harvesterActive}</h2>
                    <p className="text-gray-400 max-w-sm">
                        {TEXTS.common.adminDashboard.harvesterDescription}
                    </p>
                    <button className="mt-8 px-10 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl shadow-primary/10">
                        {TEXTS.common.adminDashboard.viewLeadDatabase}
                    </button>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, loading }: any) {
    return (
        <Card className="bg-black/40 border-white/5 backdrop-blur-xl rounded-[2rem] p-6 group hover:border-white/10 transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                    {icon}
                </div>
            </div>
            {loading ? (
                <div className="h-8 w-24 bg-white/5 animate-pulse rounded-lg" />
            ) : (
                <div className="text-4xl font-black text-white tracking-tighter">{value}</div>
            )}
            <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">{title}</div>
        </Card>
    );
}
