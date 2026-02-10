import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Disc } from "lucide-react";
import { Link } from "react-router-dom";

export default function Login() {
    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <Card className="w-full max-w-md bg-surface-dark border-gray-800">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Disc className="w-10 h-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-display font-bold text-center text-white">Welcome back</CardTitle>
                    <CardDescription className="text-center text-gray-400">
                        Enter your email to sign in to your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="email"
                            placeholder="name@example.com"
                            className="bg-black/50 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-primary"
                        />
                    </div>
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Password"
                            className="bg-black/50 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-primary"
                        />
                    </div>
                    <Button className="w-full font-bold">Sign In</Button>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-surface-dark px-2 text-gray-500">Or continue with</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <Button variant="outline" className="w-full border-gray-700 hover:bg-white/5 hover:text-white">
                            Google
                        </Button>
                        <Button variant="outline" className="w-full border-gray-700 hover:bg-white/5 hover:text-white">
                            Apple
                        </Button>
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-2">
                        Don&apos;t have an account?{" "}
                        <Link to="/register" className="text-primary hover:underline underline-offset-4">
                            Sign up
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
