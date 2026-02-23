import { useState } from "react";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    containerClassName?: string;
}

export function LazyImage({ src, alt, className, containerClassName, ...props }: LazyImageProps) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className={cn("relative overflow-hidden", containerClassName)}>
            {!loaded && (
                <Skeleton className="absolute inset-0 w-full h-full rounded-inherit" />
            )}
            <img
                src={src}
                alt={alt}
                className={cn(
                    "transition-opacity duration-500",
                    loaded ? "opacity-100" : "opacity-0",
                    className
                )}
                onLoad={() => setLoaded(true)}
                loading="lazy"
                {...props}
            />
        </div>
    );
}
