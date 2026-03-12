import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
    endDate: any; // Firebase Timestamp or Date
    onEnd?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ endDate, onEnd }) => {
    const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        const target = endDate?.toMillis ? endDate.toMillis() : new Date(endDate).getTime();

        const timer = setInterval(() => {
            const now = Date.now();
            const diff = target - now;

            if (diff <= 0) {
                clearInterval(timer);
                setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
                setIsFinished(true);
                onEnd?.();
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ d, h, m, s });
        }, 1000);

        return () => clearInterval(timer);
    }, [endDate, onEnd]);

    if (!timeLeft) return null;

    if (isFinished) {
        return (
            <div className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                Subasta Finalizada
            </div>
        );
    }

    const isUrgent = timeLeft.d === 0 && timeLeft.h < 2;

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md transition-colors ${
            isUrgent ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-primary/10 border-primary/20 text-primary'
        }`}>
            <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'animate-pulse' : ''}`} />
            <div className="flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-tighter">
                {timeLeft.d > 0 && <span>{timeLeft.d}d</span>}
                <span>{timeLeft.h.toString().padStart(2, '0')}h</span>
                <span>{timeLeft.m.toString().padStart(2, '0')}m</span>
                <span>{timeLeft.s.toString().padStart(2, '0')}s</span>
            </div>
        </div>
    );
};
