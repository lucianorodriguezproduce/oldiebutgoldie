import { Disc } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AdminLogoProps {
    className?: string;
    showText?: boolean;
}

export default function AdminLogo({ className, showText = true }: AdminLogoProps) {
    return (
        <Link to="/admin" className={cn("flex items-center gap-3 group", className)}>
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/40 transition-all" />
                <div className="relative p-2.5 bg-primary rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                    <Disc className="h-6 w-6 text-black group-hover:rotate-180 transition-transform duration-700" />
                </div>
            </div>
            {showText && (
                <div className="flex flex-col">
                    <span className="text-lg font-black tracking-tighter uppercase leading-none text-white group-hover:text-primary transition-colors">
                        Oldie but Goldie
                    </span>
                    <span className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">
                        Admin Command Center
                    </span>
                </div>
            )}
        </Link>
    );
}
