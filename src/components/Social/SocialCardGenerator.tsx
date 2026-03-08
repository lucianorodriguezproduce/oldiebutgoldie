import { useRef, useState } from 'react';
import { Download, Share2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface SocialCardGeneratorProps {
    item: {
        id: string;
        title: string;
        artist: string;
        image: string;
        source?: string;
        condition?: string;
        valuation?: number;
        price?: number;
    };
    type: 'release' | 'article';
}

export function SocialCardGenerator({ item, type }: SocialCardGeneratorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateImage = async () => {
        setIsGenerating(true);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set dimensions (1080x1920 for Stories/TikTok)
        canvas.width = 1080;
        canvas.height = 1920;

        try {
            // 1. Background (Premium Dark Gradient)
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0a0a0a');
            gradient.addColorStop(0.5, '#121212');
            gradient.addColorStop(1, '#050505');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Large Blurred Background Cover (Glassmorphic vibe)
            const bgImage = new Image();
            bgImage.crossOrigin = "anonymous";
            bgImage.src = item.image;
            await new Promise((resolve) => { bgImage.onload = resolve; });

            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.filter = 'blur(60px)';
            ctx.drawImage(bgImage, -200, -200, canvas.width + 400, canvas.height + 400);
            ctx.restore();

            // 3. Main Cover Art
            const coverSize = 880;
            const coverX = (canvas.width - coverSize) / 2;
            const coverY = 400;

            // Draw Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 100;
            ctx.shadowOffsetY = 50;

            // Rounded Corners for Cover
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(coverX, coverY, coverSize, coverSize, 40);
            ctx.clip();
            ctx.drawImage(bgImage, coverX, coverY, coverSize, coverSize);
            ctx.restore();
            ctx.shadowBlur = 0; // Reset shadow

            // 4. Texts
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';

            // Artist (Thin, Tracked)
            ctx.font = 'bold 32px Inter, sans-serif';
            ctx.globalAlpha = 0.6;
            ctx.fillText((item.artist || 'EDITORIAL').toUpperCase(), canvas.width / 2, 1380);

            // Title (Black, Display)
            ctx.globalAlpha = 1;
            ctx.font = '900 72px Inter, sans-serif';
            ctx.fillText(item.title.toUpperCase(), canvas.width / 2, 1480);

            // 5. Badge (Source/Status)
            const badgeText = item.source === 'inventory' ? 'DISPONIBLE EN TIENDA' : (type === 'article' ? 'EDITORIAL EXCLUSIVE' : 'COLECCIÓN PRIVADA');
            const badgeWidth = 400;
            const badgeX = (canvas.width - badgeWidth) / 2;
            ctx.fillStyle = '#EAB308'; // Primary Yellow
            ctx.beginPath();
            ctx.roundRect(badgeX, 1540, badgeWidth, 60, 30);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.font = '900 24px Inter, sans-serif';
            ctx.fillText(badgeText, canvas.width / 2, 1580);

            // 6. QR Code
            const baseUrl = 'https://www.oldiebutgoldie.com.ar';
            const itemUrl = `${baseUrl}/${type === 'article' ? 'comunidad' : 'archivo'}/${item.id}?ref=social_card`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(itemUrl)}&bgcolor=ffffff&color=000000`;

            const qrImage = new Image();
            qrImage.crossOrigin = "anonymous";
            qrImage.src = qrUrl;
            await new Promise((resolve) => { qrImage.onload = resolve; });

            const qrSize = 180;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = 1680;

            // QR White Background
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
            ctx.fill();
            ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

            // 7. Footer Branding
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.4;
            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.fillText('OLDIE BUT GOLDIE | OBG BUNKER', canvas.width / 2, 1890);

            // 8. Download
            const link = document.createElement('a');
            link.download = `OBG_Social_${item.id}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();

        } catch (error) {
            console.error('Image Generation Failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="relative">
            <canvas ref={canvasRef} className="hidden" />
            <Button
                onClick={generateImage}
                disabled={isGenerating}
                variant="outline"
                className="w-full bg-white/5 border-white/10 hover:border-primary/50 text-white gap-2 h-12 rounded-2xl group transition-all"
            >
                {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                    <Sparkles className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {isGenerating ? 'GENERANDO...' : 'GENERAR SOCIAL CARD'}
                </span>
            </Button>
        </div>
    );
}
