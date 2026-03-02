import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-white/5", className)}
            {...props}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="aspect-square rounded-[1.5rem] md:rounded-[2.5rem]" />
            <div className="space-y-2 px-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 opacity-50" />
            </div>
        </div>
    );
}
