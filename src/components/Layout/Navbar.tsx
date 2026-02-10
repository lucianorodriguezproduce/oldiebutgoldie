import { Bell, Disc, Search } from "lucide-react";
import { USER_PROFILE } from "@/data/mockData";
import { Button } from "@/components/ui/button";

export function Navbar() {
    return (
        <nav className="fixed w-full z-50 top-0 left-0 border-b border-white/10 bg-black/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center gap-3">
                        <Disc className="h-8 w-8 text-primary" />
                        <span className="font-display font-bold text-2xl tracking-tighter text-white">
                            SonicVault
                        </span>
                    </div>

                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-8">
                            {["Discover", "My Collection", "Wantlist", "Marketplace"].map((item) => (
                                <a
                                    key={item}
                                    href="#"
                                    className="text-gray-400 hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    {item}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
                        >
                            <Search className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
                        >
                            <Bell className="h-5 w-5" />
                        </Button>
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-secondary p-[2px]">
                            <img
                                src={USER_PROFILE.avatar}
                                alt={USER_PROFILE.name}
                                className="h-full w-full rounded-full object-cover border-2 border-black"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
