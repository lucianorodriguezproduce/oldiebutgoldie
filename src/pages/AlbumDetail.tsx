import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ALBUM_DATA, SIMILAR_ALBUMS, TRACKLIST } from "@/data/mockData";
import { Heart, Library, PlayCircle, Store } from "lucide-react";

export default function AlbumDetail() {
    const album = ALBUM_DATA;

    return (
        <div className="min-h-screen">
            <nav className="flex mb-8 text-sm text-gray-500">
                <ol className="flex items-center space-x-2">
                    <li><a href="#" className="hover:text-primary transition-colors">Discover</a></li>
                    <li>/</li>
                    <li><a href="#" className="hover:text-primary transition-colors">Electronic</a></li>
                    <li>/</li>
                    <li><a href="#" className="hover:text-primary transition-colors">{album.artist}</a></li>
                    <li>/</li>
                    <li className="text-white">{album.title}</li>
                </ol>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left Column: Cover & Actions */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-800 bg-surface-dark shadow-2xl">
                        <img
                            src={album.cover}
                            alt={album.title}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button className="h-14 text-base font-bold bg-primary text-black hover:bg-[#ccee00] rounded-xl">
                            <Library className="mr-2 h-5 w-5" />
                            Add to Collection
                        </Button>
                        <Button variant="outline" className="h-14 text-base font-bold text-secondary border-secondary hover:bg-secondary hover:text-black rounded-xl bg-transparent">
                            <Heart className="mr-2 h-5 w-5" />
                            Wantlist
                        </Button>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Store className="h-5 w-5 text-secondary" /> Marketplace
                            </h3>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 rounded font-mono">LIVE</Badge>
                        </div>
                        <div className="space-y-4 font-mono">
                            <div className="flex justify-between items-end border-b border-gray-800 pb-3">
                                <span className="text-gray-400 text-sm">Lowest</span>
                                <span className="text-2xl font-bold text-white">${album.market.lowest.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-gray-800 pb-3">
                                <span className="text-gray-400 text-sm">Median</span>
                                <span className="text-2xl font-bold text-primary">${album.market.median.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-end pb-1">
                                <span className="text-gray-400 text-sm">Highest</span>
                                <span className="text-xl text-gray-300">${album.market.highest.toFixed(2)}</span>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full mt-5 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500">
                            View {album.market.forSale} For Sale
                        </Button>
                    </div>
                </div>

                {/* Right Column: Details & Tracklist */}
                <div className="lg:col-span-7 space-y-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20 rounded-full">{album.format}</Badge>
                            <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700 rounded-full">{album.year}</Badge>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-2 leading-tight">{album.title}</h1>
                        <h2 className="text-2xl text-primary font-medium mb-6">{album.artist}</h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-surface-dark rounded-2xl border border-gray-800">
                            {[
                                { label: "Label", value: album.label },
                                { label: "Catalog #", value: album.catalogNumber },
                                { label: "Format", value: album.formatDetails },
                                { label: "Country", value: album.country },
                            ].map((item) => (
                                <div key={item.label}>
                                    <span className="block text-xs text-gray-500 uppercase mb-1">{item.label}</span>
                                    <span className="block text-white font-medium">{item.value}</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-gray-400 leading-relaxed mt-6">
                            {album.description}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-white">Tracklist</h3>
                            <span className="text-sm text-gray-500">Total Time: 74:24</span>
                        </div>
                        <div className="space-y-1">
                            {TRACKLIST.map((track) => (
                                <div key={track.position} className="group flex items-center p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-gray-800 cursor-pointer">
                                    <span className="w-8 text-gray-600 font-mono text-sm group-hover:text-primary">{track.position}</span>
                                    <div className="flex-grow">
                                        <div className="text-white font-medium">{track.title}</div>
                                        {track.artist && <div className="text-xs text-gray-500">feat. {track.artist}</div>}
                                    </div>
                                    <span className="text-gray-500 font-mono text-sm">{track.duration}</span>
                                    <div className="w-12 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PlayCircle className="text-gray-400 hover:text-white h-6 w-6" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-gray-800 my-8" />

                    <div>
                        <h3 className="text-2xl font-bold text-white mb-6">Collectors also bought</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {SIMILAR_ALBUMS.slice(0, 4).map((album) => (
                                <div key={album.title} className="group cursor-pointer">
                                    <div className="aspect-square rounded-xl overflow-hidden mb-3 relative">
                                        <img src={album.cover} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <h4 className="text-white font-bold text-sm truncate">{album.title}</h4>
                                    <p className="text-gray-500 text-xs">{album.artist}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
