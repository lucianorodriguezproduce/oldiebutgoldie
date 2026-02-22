# Design System: Oldie but Goldie
**Project ID:** 3524960004328240747

## 1. Visual Theme & Atmosphere
The project embodies a **"Modern Industrial Vinyl"** aesthetic. It is characterized by high-contrast dark modes, vibrant neon accents, and a utilitarian yet premium feel. The atmosphere is **Dense, Dynamic, and Authoritative**, using glassmorphism and deep shadows to create layers of information.

## 2. Color Palette & Roles
*   **Deep Onyx (#0A0A0A):** The core canvas. Used for main backgrounds and containers to provide maximum contrast.
*   **Neon Volt (#CCFF00):** The **Primary Accent**. Used for critical actions, brand identity, and success states. It creates a "glow" effect against the dark background.
*   **Amber Glow (#EAB308):** Used for **Pending** or cautionary states.
*   **Amethyst Purple (#C084FC):** Used for **Quoted** states or specialized admin metadata.
*   **Electric Blue (#60A5FA):** Used for **Negotiation** states and interactive elements that are not primary actions.
*   **Burnt Orange (#FB923C):** Used for **Admin Price Definitions** and counter-offers, signifying an active change in value.
*   **Soft Slate (#94A3B8):** Used for secondary text, labels, and "whisper" metadata.

## 3. Typography Rules
*   **Heading (Display):** High-impact, uppercase, tracking-tighter. Used for page titles and major section headers.
*   **Body (Primary):** Clean, geometric sans-serif (Spline Sans/Inter). High readability on mobile.
*   **Technical (Monospace):** Used for IDs, Date formats, and specific metadata like Order Numbers. Usually rendered in smaller sizes (10px) with wide tracking.

## 4. Component Stylings
*   **Badges (Status):**
    *   **Style:** Pill-shaped (`rounded-full`), small text (9px-10px), font-black, uppercase.
    *   **Border:** Subtle semi-transparent borders matching the text color (e.g., `border-primary/20`).
*   **Buttons:**
    *   **Primary:** Volt background, black text, `rounded-2xl`, wide padding.
    *   **Secondary/Tertiary:** `bg-white/5`, border `white/10`, transiton-all.
*   **Cards/Containers:**
    *   **Base:** `bg-[#0A0A0A]` or `bg-white/[0.02]`.
    *   **Geometry:** Generously rounded corners (`rounded-[2rem]` for major containers, `rounded-2xl` for items).
    *   **Elevation:** High-contrast diffused shadows (e.g., `shadow-[0_0_40px_rgba(204,255,0,0.2)]`).

## 5. Layout Principles
*   **Mobile Ergonomics:** Minimum touch targets of 44px. Bottom-heavy navigation and action triggers.
*   **Grid Strategy:** 4px basis (`p-4`, `gap-8`, `mb-8`). Airy margins to prevent visual clutter in a dense dark UI.
