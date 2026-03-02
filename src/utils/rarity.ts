/**
 * Smart Tag Logic for Oldie But Goldie Catalog.
 * Assigns rarity levels based on Discogs community demand/supply.
 */
export const getRarityTag = (community: { have?: number, want?: number } | undefined) => {
    if (!community) return null;

    const have = community.have || 0;
    const want = community.want || 0;

    // Protocol Metrics
    if (have < 50 && want > 200) return { label: "Mítica", color: "text-purple-400", bg: "bg-purple-400/10" };
    if (have < 200 && want > 500) return { label: "Rara", color: "text-amber-400", bg: "bg-amber-400/10" };
    if (want > 1000) return { label: "Alta Demanda", color: "text-blue-400", bg: "bg-blue-400/10" };

    return null;
};
