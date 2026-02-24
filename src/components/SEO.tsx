import { Helmet } from 'react-helmet-async';
import { TEXTS } from '@/constants/texts';

interface SEOProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    schema?: Record<string, any>;
    status?: string;
}

export function SEO({
    title = TEXTS.common.seo.defaultTitle,
    description = TEXTS.common.seo.defaultDescription,
    image = 'https://www.oldiebutgoldie.com.ar/og-image.jpg',
    url,
    type = 'website',
    schema,
    status
}: SEOProps) {
    const canonicalBase = 'https://www.oldiebutgoldie.com.ar';
    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : canonicalBase);

    // Make sure image is an absolute HTTPS URL if it isn't already
    let ogImage = image.startsWith('http') ? image : `${canonicalBase}${image.startsWith('/') ? '' : '/'}${image}`;

    // SocialPreviewManager Logic
    if (status && ['pending', 'quoted'].includes(status.toLowerCase())) {
        const encodedImageUrl = encodeURIComponent(ogImage);
        ogImage = `https://res.cloudinary.com/demo/image/fetch/w_800,h_800,c_fill,e_brightness:-20/l_text:Arial_50_bold_center:%C2%A1Negociaci%C3%B3n%20Abierta!,co_white,g_south,y_40/${encodedImageUrl}`;
    }

    const defaultSchema = {
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        "name": "Oldie but Goldie",
        "url": currentUrl,
        "description": description,
        "image": image,
        "founder": "Luciano Rodriguez"
    };

    const finalSchema = schema || defaultSchema;

    return (
        <Helmet>
            {/* Standard HTML Metadata */}
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={currentUrl} />

            {/* Robots directive for staging */}
            <meta name="robots" content="noindex, nofollow" />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={currentUrl} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* JSON-LD Structured Data */}
            <script type="application/ld+json">
                {JSON.stringify(finalSchema)}
            </script>
        </Helmet>
    );
}
