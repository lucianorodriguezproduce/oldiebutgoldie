import { EditorialItemCard } from "./EditorialItemCard";

interface ShortcodeRendererProps {
    content: string;
}

export function ShortcodeRenderer({ content }: ShortcodeRendererProps) {
    if (!content) return null;

    // Pattern: [DISCO:ID]
    const parts = content.split(/(\[DISCO:[a-zA-Z0-9_-]+\])/g);

    return (
        <div className="editorial-content space-y-6">
            {parts.map((part, i) => {
                if (part.startsWith('[DISCO:') && part.endsWith(']')) {
                    const id = part.substring(7, part.length - 1);
                    return <EditorialItemCard key={i} id={id} />;
                }

                if (!part.trim()) return null;

                return (
                    <div
                        key={i}
                        className="prose prose-invert prose-lg max-w-none text-gray-300 leading-[1.8] text-xl md:text-2xl font-serif"
                        dangerouslySetInnerHTML={{ __html: part }}
                    />
                );
            })}
        </div>
    );
}
