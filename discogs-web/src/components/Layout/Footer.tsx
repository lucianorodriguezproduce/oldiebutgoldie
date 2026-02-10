import { Disc } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-black mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Disc className="h-6 w-6 text-primary" />
                        <span className="font-display font-bold text-xl tracking-tighter text-white">
                            SonicVault
                        </span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-400">
                        {["About", "API Status", "Terms", "Privacy"].map((item) => (
                            <a
                                key={item}
                                href="#"
                                className="hover:text-primary transition-colors"
                            >
                                {item}
                            </a>
                        ))}
                    </div>
                    <div className="text-sm text-gray-500">
                        © 2023 SonicVault. Data provided by Discogs.
                    </div>
                </div>
            </div>
        </footer>
    );
}
