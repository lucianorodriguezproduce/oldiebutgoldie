declare global {
    interface Window {
        dataLayer: any[];
    }
}
export const getSourceChannel = (): string => {
    if (typeof window === 'undefined') return 'direct';
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.toLowerCase();
    const utmSource = params.get('utm_source')?.toLowerCase();

    if (ref) return ref;
    if (utmSource) return utmSource;

    const referrer = document.referrer.toLowerCase();
    if (referrer.includes('whatsapp.com')) return 'whatsapp';
    if (referrer.includes('facebook.com') || referrer.includes('instagram.com')) return 'social_media';
    if (referrer.includes('google.')) return 'google_search';
    if (referrer) return 'referral';

    return 'direct';
};

export const pushViewItem = (item: any, intent: string) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];

        let genreCategory = "N/A";
        if (item.genre && item.genre.length > 0) {
            genreCategory = item.genre[0];
        } else if (item.style && item.style.length > 0) {
            genreCategory = item.style[0];
        }

        const artistName = item.title?.includes(' - ') ? item.title.split(' - ')[0] : item.title;
        const albumName = item.title?.includes(' - ') ? item.title.split(' - ')[1] : item.title;

        window.dataLayer.push({
            'event': 'view_item',
            'ecommerce': {
                'detail': {
                    'products': [{
                        'id': item.id?.toString(),
                        'name': albumName?.trim() || item.title,
                        'brand': artistName?.trim() || 'Unknown',
                        'category': genreCategory,
                        'variant': intent
                    }]
                }
            }
        });
    }
};

export const pushViewItemFromOrder = (order: any) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];

        window.dataLayer.push({
            'event': 'view_item',
            'ecommerce': {
                'detail': {
                    'products': [{
                        'id': order.item_id?.toString() || 'N/A',
                        'name': order.details?.album || 'Unknown',
                        'brand': order.details?.artist || 'Unknown',
                        'category': 'N/A', // Genre logic usually not stored statically in orders
                        'variant': order.details?.intent || 'OBSERVANDO',
                        'Source_Channel': getSourceChannel()
                    }]
                }
            }
        });
    }
};

export const pushWhatsAppContactFromOrder = (order: any) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];

        window.dataLayer.push({
            'event': 'whatsapp_contact',
            'item_id': order.item_id?.toString() || 'N/A',
            'item_name': order.details?.album || 'Unknown',
            'intent': order.details?.intent || 'UNKNOWN',
            'Source_Channel': getSourceChannel()
        });
    }
};

export const pushHotOrderDetected = (order: any, viewCount: number) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];

        window.dataLayer.push({
            'event': 'hot_order_detected',
            'item_id': order.item_id?.toString() || order.id || 'N/A',
            'item_name': order.details?.album || order.title || 'Unknown',
            'view_count': viewCount,
            'status': order.status
        });
    }
};

export const pushBulkUploadCompleted = (itemCount: number) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'bulk_upload_completed',
            'item_count': itemCount,
            'source': 'admin_dashboard'
        });
    }
};

export const pushPurchaseSuccess = (transactionId: string, value: number, itemsCount: number) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'purchase_success',
            'transactionId': transactionId,
            'value': value,
            'currency': 'ARS',
            'items_count': itemsCount
        });
    }
};

export const pushLeadGenerated = (type: 'discogs_request' | 'c2b_offer' | 'other', value: number = 0, itemsCount: number = 1, transactionId?: string) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'lead_generated',
            'lead_type': type,
            'value': value,
            'currency': 'ARS',
            'items_count': itemsCount,
            'transactionId': transactionId
        });
    }
};

export const pushAssetCreated = (userId: string, itemId: string, itemName: string) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'asset_created',
            'userId': userId,
            'item_id': itemId,
            'item_name': itemName
        });
    }
};

export const pushEditorialView = (article: any) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'editorial_view',
            'article_id': article.id,
            'title': article.title,
            'category': article.category,
            'author': article.author,
            'read_time': article.readTime
        });
    }
};

export const pushWizardStep = (stepName: string, data: any = {}) => {
    if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'wizard_step',
            'step_name': stepName,
            ...data,
            'Source_Channel': getSourceChannel()
        });
    }
};
