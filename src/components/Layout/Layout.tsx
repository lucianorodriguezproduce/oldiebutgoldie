import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Layout() {
    return (
        <div className="flex flex-col min-h-screen bg-background-dark text-white font-sans selection:bg-primary selection:text-black">
            <Navbar />
            <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
