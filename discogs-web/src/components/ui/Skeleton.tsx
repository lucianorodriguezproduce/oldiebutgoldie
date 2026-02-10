import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-white/5", className)}
            {...props}
        />
    );
}

export function AlbumCardSkeleton() {
    return (
        <div className="p-4 space-y-4">
            <Skeleton className="aspect-square rounded-2xl w-full" />
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
        </div>
    );
}

export function AlbumDetailSkeleton() {
    return (
        <div className="space-y-12 py-10">
            <Skeleton className="h-4 w-1/3 rounded-full mb-12" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-5 space-y-8">
                    <Skeleton className="aspect-square rounded-[2rem] w-full" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-16 rounded-2xl w-full" />
                        <Skeleton className="h-16 rounded-2xl w-full" />
                    </div>
                </div>
                <div className="lg:col-span-7 space-y-8">
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-2/3 rounded-full" />
                        <Skeleton className="h-8 w-1/2 rounded-full" />
                    </div>
                    <Skeleton className="h-32 rounded-[2rem] w-full" />
                    <div className="space-y-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-2xl w-full" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
