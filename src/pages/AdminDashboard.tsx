import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TEXTS } from '@/constants/texts';
import { LineChart, Activity, MousePointerClick, TrendingUp, Search, Users, Clock, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { runReport } from '@/services/analyticsService';
import type { AnalyticsDataPoint } from '@/services/analyticsService';

export interface SearchConsoleData {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

export interface AnalyticsSummary {
    totalClicks: number;
    totalImpressions: number;
    averageCTR: number;
    averagePosition: number;
}

export default function AdminDashboard() {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [keywords, setKeywords] = useState<SearchConsoleData[]>([]);
    const [chartData, setChartData] = useState<AnalyticsDataPoint[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setIsLoading(true);
            try {
                // Fetch GA4 Data API via our custom service
                const gaData = await runReport();
                setChartData(gaData);

                // Mock data for structural setup
                setSummary({
                    totalClicks: 12450,
                    totalImpressions: 154200,
                    averageCTR: 8.07,
                    averagePosition: 12.4
                });

                const mockKeywords: SearchConsoleData[] = Array.from({ length: 100 }, (_, i) => ({
                    query: `vinilos de rock vol ${i + 1}`,
                    clicks: Math.floor(Math.random() * 500) + 10,
                    impressions: Math.floor(Math.random() * 5000) + 100,
                    ctr: Number((Math.random() * 20 + 1).toFixed(1)),
                    position: Number((Math.random() * 50 + 1).toFixed(1))
                }));

                // Override top 3 for realistic visuals
                mockKeywords[0] = { query: "comprar vinilos de rock", clicks: 340, impressions: 2100, ctr: 16.1, position: 3.2 };
                mockKeywords[1] = { query: "oldie but goldie discos", clicks: 215, impressions: 450, ctr: 47.7, position: 1.1 };
                mockKeywords[2] = { query: "cotizador de discos de vinilo", clicks: 180, impressions: 1200, ctr: 15.0, position: 4.5 };

                // Sort by clicks descending
                mockKeywords.sort((a, b) => b.clicks - a.clicks);

                setKeywords(mockKeywords);
            } catch (error) {
                // Production: Silent fail or logging service
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    const filteredKeywords = useMemo(() => {
        return keywords.filter(kw =>
            kw.query.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [keywords, searchTerm]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            <header className="mb-8">
                <h1 className="text-3xl font-display font-black text-white italic uppercase tracking-tighter">
                    {TEXTS.admin.dashboard.title}
                </h1>
                <p className="text-gray-400 font-medium">{TEXTS.admin.dashboard.subtitle}</p>
            </header>

            {/* Industrial KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 text-emerald-400">
                            <Users className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Active Now</span>
                        </div>
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                    </div>
                    <div className="text-4xl font-black text-white">{isLoading ? '-' : '24'}</div>
                    <div className="mt-2 text-xs text-gray-500 font-medium">Usuarios concurrentes</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4 text-blue-400">
                        <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Traffic Flow</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-4xl font-black text-white">{isLoading ? '-' : chartData.reduce((acc, curr) => acc + curr.sessions, 0).toLocaleString()}</div>
                        <div className="text-sm font-bold text-emerald-400">+14%</div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 font-medium">Sesiones (Últimos 7 días)</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4 text-orange-400">
                        <Clock className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Retention Score</span>
                    </div>
                    <div className="text-4xl font-black text-white">{isLoading ? '-' : '01:24'}</div>
                    <div className="mt-2 text-xs text-gray-500 font-medium">Tiempo promedio de lectura</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4 text-purple-400">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">Conversion</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <div className="text-4xl font-black text-white">{isLoading ? '-' : '3.8%'}</div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 font-medium">Interacciones de Ofertas</div>
                </motion.div>
            </div>

            {/* Recharts Area - Visual Analytics Engine */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center justify-between">
                    <span>Volumen de Visitantes</span>
                    {selectedKeyword && (
                        <div className="flex items-center gap-2 text-primary text-xs bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                            <Search className="w-3 h-3" />
                            <span>Viendo tráfico referencial de: "{selectedKeyword}"</span>
                            <button onClick={() => setSelectedKeyword(null)} className="ml-2 hover:text-white transition-colors">
                                <span className="sr-only">Clear</span>
                                &times;
                            </button>
                        </div>
                    )}
                </h2>
                <div className="h-[300px] w-full">
                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono text-sm animate-pulse">
                            [ ESTABLECIENDO CONEXIÓN CON DATA-HUB... ]
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={selectedKeyword ? "#D73C4C" : "#8884d8"} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={selectedKeyword ? "#D73C4C" : "#8884d8"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#666', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#888', marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={selectedKeyword ? "activeUsers" : "sessions"}
                                    stroke={selectedKeyword ? "#D73C4C" : "#8884d8"}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSessions)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </motion.div>

            {/* Keyword Tracking Table */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mt-8 flex flex-col">
                <div className="p-6 border-b border-white/10 bg-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <LineChart className="w-5 h-5 text-primary" />
                        {TEXTS.admin.dashboard.dominantKeywords}
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder={TEXTS.admin.dashboard.searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 w-full md:w-64 transition-colors"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur shadow-sm border-b border-white/5">
                            <tr className="text-xs font-black uppercase tracking-widest text-gray-500">
                                <th className="p-4 pl-6 w-16">#</th>
                                <th className="p-4">Query</th>
                                <th className="p-4">Clicks</th>
                                <th className="p-4">Impressions</th>
                                <th className="p-4">CTR</th>
                                <th className="p-4 pr-6">Position</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Cargando métricas...</td></tr>
                            ) : filteredKeywords.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No se encontraron resultados para "{searchTerm}"</td></tr>
                            ) : filteredKeywords.map((kw, i) => (
                                <tr
                                    key={i}
                                    onClick={() => setSelectedKeyword(kw.query)}
                                    className={`hover:bg-white/5 transition-colors group cursor-pointer ${selectedKeyword === kw.query ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                                >
                                    <td className="p-4 pl-6 text-gray-600 font-mono text-xs">{i + 1}</td>
                                    <td className="p-4 font-medium text-white group-hover:text-primary transition-colors">{kw.query}</td>
                                    <td className="p-4 text-primary">{kw.clicks}</td>
                                    <td className="p-4 text-blue-400">{kw.impressions}</td>
                                    <td className="p-4 text-green-400">{kw.ctr}%</td>
                                    <td className="p-4 text-purple-400">#{kw.position}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
