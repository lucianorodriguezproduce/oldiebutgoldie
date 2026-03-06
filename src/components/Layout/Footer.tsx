import { Disc } from "lucide-react";
import { Link } from "react-router-dom";
import { TEXTS } from "@/constants/texts";

export function Footer() {
    const labels: Record<string, string> = {
        "About": "Nosotros",
        "API Status": "Estado de API",
        "Terms": "Términos",
        "Privacy": "Privacidad"
    };

    return (
        <footer className="border-t border-white/10 bg-black mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Disc className="h-6 w-6 text-primary" />
                        <span className="font-display font-bold text-xl tracking-tighter text-white">
                            Oldie but Goldie
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-gray-400 justify-center">
                        <Link to="/tienda" className="hover:text-primary transition-colors uppercase tracking-widest text-[10px] font-black">
                            {TEXTS.global.navigation.tienda}
                        </Link>
                        <Link to="/comercio" className="hover:text-primary transition-colors uppercase tracking-widest text-[10px] font-black">
                            {TEXTS.global.navigation.activity}
                        </Link>
                        <Link to="/comunidad" className="hover:text-primary transition-colors uppercase tracking-widest text-[10px] font-black">
                            {TEXTS.global.navigation.editorial}
                        </Link>
                        <Link to="/guias" className="hover:text-primary transition-colors uppercase tracking-widest text-[10px] font-black">
                            {TEXTS.global.navigation.guias}
                        </Link>
                        {["About", "API Status", "Terms", "Privacy"].map((item) => (
                            <a
                                key={item}
                                href="#"
                                className="hover:text-primary transition-colors uppercase tracking-widest text-[10px] font-black"
                            >
                                {labels[item] || item}
                            </a>
                        ))}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">
                        © {new Date().getFullYear()} Oldie but Goldie. Datos proporcionados por Discogs.
                    </div>
                </div>
            </div>
        </footer>
    );
}
