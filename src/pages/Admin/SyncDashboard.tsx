import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, Key, Server, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SyncDashboard() {
    const stats = [
        { label: "API Connectivity", value: "99.9%", status: "healthy", icon: Server },
        { label: "Last Synchronization", value: "2m ago", status: "active", icon: RefreshCw },
        { label: "Database Integrity", value: "Optimal", status: "healthy", icon: Database },
        { label: "Harvested Leads", value: "1,284", status: "active", icon: Activity },
    ];

    return (
        <div className="space-y-10">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">Sync <span className="text-primary">Engine</span></h1>
                    <p className="text-gray-500 mt-4 text-lg font-medium max-w-2xl">Deterministic management of Discogs API ingestion and global data synchronization.</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full font-black tracking-widest uppercase text-[10px]">
                    System Status: Operational
                </Badge>
            </header>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <Card className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2rem] p-6 hover:border-white/10 transition-all group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="p-3 bg-primary/10 rounded-2xl group-hover:bg-primary transition-colors">
                                    <stat.icon className="h-5 w-5 text-primary group-hover:text-black transition-colors" />
                                </div>
                                {stat.status === "healthy" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
                                )}
                            </div>
                            <div className="text-4xl font-black text-white tracking-tighter mb-1">{stat.value}</div>
                            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Token Management */}
                <Card className="lg:col-span-2 bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-10 border-b border-white/5 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                                <Key className="h-6 w-6 text-primary" />
                                Access Configuration
                            </CardTitle>
                            <CardDescription className="text-gray-500 mt-1">Manage secure identifiers for global service access.</CardDescription>
                        </div>
                        <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white font-bold rounded-xl h-12 px-6">
                            Rotate All Keys
                        </Button>
                    </CardHeader>
                    <CardContent className="p-10 space-y-8">
                        <TokenRow name="Discogs V3 API" token="••••••••••••••••••••••••" status="Active" expires="Permanent" />
                        <TokenRow name="Stitch Design Service" token="••••••••••••••••••••••••" status="Active" expires="2026-12-31" />
                        <TokenRow name="Firebase Telemetry" token="••••••••••••••••••••••••" status="Restricted" expires="2026-06-15" />
                    </CardContent>
                </Card>

                {/* System Alerts */}
                <Card className="bg-primary/5 border border-primary/20 backdrop-blur-3xl rounded-[2.5rem] p-10 flex flex-col">
                    <div className="w-16 h-16 bg-primary rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center mb-8">
                        <AlertCircle className="text-black h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-4">Network Intelligence</h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-8">
                        The system is currently operating within optimal parameters. No performance bottlenecks detected in Argentina region harvests.
                    </p>
                    <div className="space-y-4 mt-auto">
                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Latency (BUE)</div>
                            <div className="text-xl font-black text-white">42ms</div>
                        </div>
                        <div className="p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">CORS Success Rate</div>
                            <div className="text-xl font-black text-white">100%</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Sync History / Log */}
            <Card className="bg-white/[0.03] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-10 border-b border-white/5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <Activity className="h-6 w-6 text-primary" />
                            Synchronization History
                        </CardTitle>
                        <CardDescription className="text-gray-500 mt-1">Real-time log of data ingestion and database reconciliation.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Process</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Timestamp</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Region</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: "Argentina Discogs Harvest", time: "2m ago", region: "LATAM-S", status: "Success" },
                                    { name: "Master Ledger Reconciliation", time: "15m ago", region: "GLOBAL", status: "Success" },
                                    { name: "API Rate Limit Assessment", time: "1h ago", region: "GLOBAL", status: "Warning" },
                                    { name: "Release Metadata Update", time: "3h ago", region: "EU-W", status: "Success" },
                                ].map((log, i) => (
                                    <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{log.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 font-mono text-xs text-gray-500">{log.time}</td>
                                        <td className="px-10 py-6">
                                            <Badge variant="outline" className="border-white/10 text-gray-400 font-bold">{log.region}</Badge>
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-lg",
                                                log.status === "Success" ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                                            )}>{log.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function TokenRow({ name, token, status, expires }: any) {
    return (
        <div className="flex items-center justify-between group">
            <div className="space-y-1">
                <div className="text-sm font-bold text-white">{name}</div>
                <div className="text-[10px] font-mono text-gray-500 tracking-wider uppercase">{token}</div>
            </div>
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Expires</div>
                    <div className="text-xs font-black text-white">{expires}</div>
                </div>
                <Badge className={cn(
                    "px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-tighter",
                    status === "Active" ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                )}>
                    {status}
                </Badge>
            </div>
        </div>
    );
}
