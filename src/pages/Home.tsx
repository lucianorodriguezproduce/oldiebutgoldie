import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SIMILAR_ALBUMS } from "@/data/mockData";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
    return (
        <div className="space-y-8">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    className="pl-10 bg-surface-dark border-gray-800 text-white placeholder:text-gray-500 h-12 text-lg focus-visible:ring-primary"
                    placeholder="Search for artists, albums, or tracks..."
                />
            </div>

            <section>
                <h2 className="text-2xl font-display font-bold text-white mb-6">Trending Releases</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {SIMILAR_ALBUMS.map((album) => (
                        <Link key={album.title} to="/album/random-access-memories" className="group block">
                            <Card className="bg-transparent border-0 shadow-none">
                                <CardContent className="p-0">
                                    <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-surface-dark">
                                        <img
                                            src={album.cover}
                                            alt={album.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <h3 className="text-white font-bold text-sm truncate">{album.title}</h3>
                                    <p className="text-gray-500 text-xs">{album.artist}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
