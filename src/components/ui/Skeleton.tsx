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
            <Skeleton className="aspect-square md:aspect-[3/4] rounded-[1.5rem] md:rounded-[2.5rem]" />
            <div className="space-y-2 px-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 opacity-50" />
            </div>
        </div>
    );
}
export function AlbumDetailSkeleton() {
    return (
        <div className="space-y-12 animate-pulse">
            <div className="h-6 w-48 bg-white/5 rounded-full" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
                <div className="lg:col-span-5 space-y-12">
                    <div className="aspect-square bg-white/5 rounded-[3rem]" />
                    <div className="h-20 bg-white/5 rounded-2xl" />
                </div>
                <div className="lg:col-span-7 space-y-10">
                    <div className="h-20 w-3/4 bg-white/5 rounded-3xl" />
                    <div className="h-10 w-1/2 bg-white/5 rounded-2xl" />
                    <div className="h-40 bg-white/5 rounded-[3rem]" />
                </div>
            </div>
        </div>
    );
}
