import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Lock, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SecuritySettings() {
    return (
        <div className="space-y-10">
            <header>
                <h1 className="text-6xl font-display font-black text-white tracking-tightest leading-none">Access <span className="text-primary">Control</span></h1>
                <p className="text-gray-500 mt-4 text-lg font-medium max-w-2xl">Configuration of system-level security protocols and perimeter protection.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl rounded-[2.5rem]">
                    <CardHeader className="p-10 border-b border-white/5">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <Shield className="h-6 w-6 text-primary" />
                            Perimeter Defense
                        </CardTitle>
                        <CardDescription className="text-gray-500 mt-1">Manage global access rules and IP blacklisting.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <span className="text-gray-300 font-bold">Automatic IP Blocking</span>
                            <Badge className="bg-green-500 text-black font-black uppercase text-[9px] px-3 border-none">Enabled</Badge>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl">
                            <span className="text-gray-300 font-bold">Encryption Protocol</span>
                            <span className="text-primary font-black uppercase text-[10px]">AES-256-GCM</span>
                        </div>
                        <Button className="w-full h-14 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all">Update Encryption Keys</Button>
                    </CardContent>
                </Card>

                <Card className="bg-white/[0.02] border-white/5 backdrop-blur-3xl rounded-[2.5rem]">
                    <CardHeader className="p-10 border-b border-white/5">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                            <Lock className="h-6 w-6 text-orange-400" />
                            Credential Management
                        </CardTitle>
                        <CardDescription className="text-gray-500 mt-1">Configure identifier rotation and backup access codes.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Authentication is currently managed via Firebase Auth. Credentials for the "System Pilot" account are hardcoded for fallback access.
                        </p>
                        <div className="pt-4 border-t border-white/5 flex gap-4">
                            <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5 text-white font-bold h-12 rounded-xl gap-2">
                                <Eye className="h-4 w-4" /> View Logs
                            </Button>
                            <Button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl border border-white/5 gap-2">
                                <Save className="h-4 w-4" /> Save Config
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
