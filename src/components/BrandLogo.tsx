import React, { useState, useEffect } from 'react';
import { Disc } from 'lucide-react';
import { siteConfigService, type SiteConfig } from '@/services/siteConfigService';
import { cn } from '@/lib/utils';
import { TEXTS } from '@/constants/texts';

interface BrandLogoProps {
    className?: string;
    imgClassName?: string;
    showText?: boolean;
    textClassName?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeConfig = {
    sm: { icon: 'h-5 w-5', text: 'text-sm', img: 'h-6' },
    md: { icon: 'h-8 w-8', text: 'text-xl', img: 'h-10' },
    lg: { icon: 'h-10 w-10', text: 'text-2xl', img: 'h-14' },
    xl: { icon: 'h-12 w-12', text: 'text-4xl', img: 'h-20' }
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ 
    className, 
    imgClassName, 
    showText = true, 
    textClassName,
    size = 'md' 
}) => {
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            const data = await siteConfigService.getConfig();
            setConfig(data);
            setLoading(false);
        };
        fetchConfig();

        // Sincronía en tiempo real para cambios de branding en vivo
        return siteConfigService.onSnapshotConfig((newConfig) => {
            setConfig(newConfig);
            setLoading(false);
        });
    }, []);

    const s = sizeConfig[size];

    return (
        <div className={cn("flex items-center gap-3 transition-all duration-500", className)}>
            <div className="relative flex items-center justify-center">
                {loading ? (
                    <div className={cn("bg-white/5 animate-pulse rounded-lg", s.img, "w-32")} />
                ) : config?.logo?.url ? (
                    <img
                        src={config.logo.url}
                        alt={TEXTS.global.navigation.brand}
                        className={cn(s.img, "w-auto object-contain", imgClassName)}
                        // Prevent CLS by providing a min-width placeholder if needed
                        style={{ minWidth: '40px' }}
                    />
                ) : (
                    <Disc className={cn(s.icon, "text-primary animate-spin-slow", imgClassName)} />
                )}
            </div>

            {showText && (!config?.logo?.url || loading === false) && (
                <span className={cn(
                    "font-display font-bold tracking-tightest text-white uppercase",
                    s.text,
                    textClassName
                )}>
                    {TEXTS.global.navigation.brand}
                </span>
            )}
        </div>
    );
};
