import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Terminal, Globe, User, Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TelemetryLogs() {
    const { data: logs, isLoading } = useQuery({
        queryKey: ["telemetry-logs"],
        queryFn: async () => {
            const q = query(collection(db, "interactions"), orderBy("timestamp", "desc"), limit(50));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        refetchInterval: 5000, // Refresh every 5 seconds
    });

    return (
        <div className="space-y-10">
            <header>
                <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">System <span className="text-primary">Logs</span></h1>
                <p className="text-gray-500 mt-4 text-lg font-medium max-w-2xl">Real-time telemetry streams from global interaction nodes.</p>
            </header>

            <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Terminal className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold text-white uppercase tracking-tight">Main Terminal Stream</CardTitle>
                            <CardDescription className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mt-0.5">Filter: ALL_EVENTS | Origin: GLOBAL</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live Monitoring</span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto font-mono text-[11px] leading-relaxed">
                        {isLoading ? (
                            <div className="p-20 text-center text-gray-600 animate-pulse font-black uppercase tracking-widest">Initialising Secure Stream...</div>
                        ) : logs?.length === 0 ? (
                            <div className="p-20 text-center text-gray-600 font-black uppercase tracking-widest">No active interaction signals detected.</div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-[#0d0d0d] text-gray-600 uppercase tracking-tighter font-black border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-black">Timestamp</th>
                                        <th className="px-6 py-4 text-left font-black">Origin</th>
                                        <th className="px-6 py-4 text-left font-black">Agent</th>
                                        <th className="px-6 py-4 text-left font-black">Action</th>
                                        <th className="px-6 py-4 text-left font-black">Resource</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {logs?.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-bold flex items-center gap-3">
                                                <Clock className="h-3 w-3 text-primary/40" />
                                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'PENDING'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-white font-black uppercase">
                                                    <Globe className="h-3 w-3 text-blue-400" />
                                                    {log.location?.city || "Unknown"}, {log.location?.country || "Earth"}
                                                </div>
                                                <div className="text-[9px] text-gray-600 mt-0.5 tracking-tight">{log.location?.ip}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-gray-300 font-bold">
                                                    <User className="h-3 w-3 text-orange-400" />
                                                    {log.uid ? log.uid.substring(0, 8) : "ANONYMOUS"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge className="bg-white/5 border-white/10 text-white font-black text-[9px] uppercase tracking-tighter px-2 py-0.5">
                                                    {log.action}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 group-hover:text-primary transition-colors italic">
                                                {log.resourceId}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="bg-primary p-3 rounded-2xl">
                        <Search className="h-5 w-5 text-black" />
                    </div>
                    <div>
                        <h4 className="text-white font-black text-lg">Predictive Analysis</h4>
                        <p className="text-gray-500 text-xs font-medium">System is analyzing traffic patterns to optimize Argentina harvest cycles.</p>
                    </div>
                </div>
                <Button className="bg-primary text-black font-black uppercase tracking-widest px-8 rounded-xl h-12">Export Dataset</Button>
            </div>
        </div>
    );
}
