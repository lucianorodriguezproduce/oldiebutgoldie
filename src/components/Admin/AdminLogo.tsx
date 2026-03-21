import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

interface AdminLogoProps {
    className?: string;
}

export default function AdminLogo({ className }: AdminLogoProps) {
    return (
        <Link to="/admin" className={cn("flex items-center gap-3 group relative", className)}>
            <div className="absolute inset-x-[-10px] inset-y-[-5px] bg-primary/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <BrandLogo size="md" textClassName="text-white group-hover:text-primary transition-colors" />
            <div className="flex flex-col ml-[-4px]">
                <span className="text-[8px] text-primary font-black uppercase tracking-[0.2em] opacity-80">
                    System Pilot
                </span>
            </div>
        </Link>
    );
}
