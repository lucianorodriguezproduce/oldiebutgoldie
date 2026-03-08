import { Calendar, User, Disc, Tag, Layers } from "lucide-react";

interface ProfessionalReviewProps {
    title: string;
    author: string;
    publishDate: Date;
    label: string;
    releaseYear: number;
    format: string;
    coverImageUrl: string;
    content: string; // HTML o Markdown string
}

export default function ProfessionalReview({
    title,
    author,
    publishDate,
    label,
    releaseYear,
    format,
    coverImageUrl,
    content
}: ProfessionalReviewProps) {
    return (
        <article className="max-w-4xl mx-auto space-y-12 pb-16">
            {/* Header Alta Resolución */}
            <header className="space-y-6">
                <div className="aspect-[21/9] w-full relative overflow-hidden rounded-[2rem] border border-white/10 group">
                    <img
                        src={coverImageUrl}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter font-display leading-[0.9]">
                    {title}
                </h1>

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 font-medium tracking-widest uppercase">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <span>Curado por {author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{publishDate.toLocaleDateString()}</span>
                    </div>
                </div>
            </header>

            {/* Metadatos Curados */}
            <div className="flex flex-wrap gap-4 p-6 bg-[#0a0a0a] rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                    <Disc className="w-5 h-5 text-gray-400" />
                    <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Sello</p>
                        <p className="text-sm font-black text-white">{label}</p>
                    </div>
                </div>
                <div className="w-px h-10 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Año</p>
                        <p className="text-sm font-black text-white">{releaseYear}</p>
                    </div>
                </div>
                <div className="w-px h-10 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-gray-400" />
                    <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Formato</p>
                        <p className="text-sm font-black text-white">{format}</p>
                    </div>
                </div>
                <div className="w-px h-10 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-3">
                    <Tag className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Criterio OBG</p>
                        <p className="text-sm font-black text-white">Nota de Batea</p>
                    </div>
                </div>
            </div>

            {/* Cuerpo de Texto */}
            <div className="prose prose-invert prose-p:text-gray-400 prose-headings:text-white prose-a:text-primary max-w-none text-lg leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: content }} />
            </div>

            {/* CTA Visibilidad Profesional */}
            <div className="mt-16 p-8 rounded-3xl bg-primary/10 border border-primary/20 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Disc className="w-32 h-32 text-primary animate-[spin_20s_linear_infinite]" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Cultura de Batea</h3>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    Exploramos el sonido profundo y las historias detrás de cada surco.
                    Oldie But Goldie es tu punto de encuentro para el coleccionista avanzado.
                </p>
                <button className="px-8 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-colors relative z-10">
                    Descubrir Más Formatos Físicos
                </button>
            </div>
        </article>
    );
}
