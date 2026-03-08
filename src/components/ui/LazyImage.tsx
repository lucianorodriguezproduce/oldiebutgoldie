import { useState } from "react";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
    aspectRatio?: string;
    priority?: boolean;
    width?: number | string;
    height?: number | string;
}

export function LazyImage({
    src,
    alt,
    className,
    containerClassName,
    aspectRatio = '1/1',
    priority = false,
    width,
    height,
    ...props
}: LazyImageProps) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    // Optimized Image formats are usually handled by the source (Firebase/Discogs CDN)
    // but we ensure the HTML handles it correctly.

    return (
        <div
            className={cn("relative overflow-hidden group/image bg-white/5", containerClassName)}
            style={aspectRatio ? { aspectRatio } : undefined}
        >
            {!loaded && !error && (
                <Skeleton className="absolute inset-0 w-full h-full rounded-inherit" />
            )}

            {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm border border-white/10 rounded-inherit">
                    <ImageOff className="w-8 h-8 text-white/20 mb-2 group-hover/image:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Failed to load</span>
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    width={width}
                    height={height}
                    fetchPriority={priority ? "high" : "auto"}
                    loading={priority ? "eager" : "lazy"}
                    className={cn(
                        "transition-all duration-700 ease-out",
                        loaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                        className
                    )}
                    onLoad={() => setLoaded(true)}
                    onError={() => {
                        setError(true);
                        setLoaded(false);
                    }}
                    {...props}
                />
            )}
        </div>
    );
}
