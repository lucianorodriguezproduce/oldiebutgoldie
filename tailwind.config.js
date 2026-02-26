/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#FFB800', // Oldie But Goldie (Gold Top)
                    foreground: '#000000'
                },
                secondary: {
                    DEFAULT: '#FF4D00', // Retro Orange-Red
                    foreground: '#FFFFFF'
                },
                accent: {
                    DEFAULT: '#00D1FF', // Retro Cyan-Blue
                    foreground: '#FFFFFF'
                },
                'background-dark': '#080808',
                'surface-dark': '#121212',
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: '0.5rem',
                md: 'calc(0.5rem - 2px)',
                sm: 'calc(0.5rem - 4px)',
                xl: '1rem',
                '2xl': '1.5rem',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Space Grotesk', 'sans-serif'],
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
