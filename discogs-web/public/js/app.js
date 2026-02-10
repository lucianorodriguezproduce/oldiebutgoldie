// Main App Logic - Navigation and Collection Management
class MusicCollectionApp {
    constructor() {
        this.collection = this.loadCollection();
        this.currentUser = this.loadUser();
        this.init();
    }

    init() {
        // Set up navigation
        this.setupNavigation();

        // Check if user is logged in
        if (!this.currentUser && !window.location.pathname.includes('index.html')) {
            // Redirect to login if not on index page
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                // Allow access for now (demo mode)
            }
        }
    }

    setupNavigation() {
        // Add click handlers to navigation links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (link) {
                e.preventDefault();
                const page = link.getAttribute('href').substring(1);
                this.navigateTo(page);
            }
        });
    }

    navigateTo(page) {
        const pageMap = {
            'home': 'home.html',
            'search': 'search.html',
            'collection': 'collection.html',
            'stores': 'stores.html',
            'map': 'stores.html',
            'profile': 'profile.html',
            'community': 'community.html',
            'admin': '/admin/index.html'
        };

        const targetPage = pageMap[page] || 'home.html';

        // Basic access control
        if (page === 'admin' && !this.isAdmin()) {
            this.showNotification('Acceso restringido a administradores', 'error');
            return;
        }

        window.location.href = targetPage;
    }

    // Collection Management
    loadCollection() {
        const stored = localStorage.getItem('music_collection');
        return stored ? JSON.parse(stored) : [];
    }

    saveCollection() {
        localStorage.setItem('music_collection', JSON.stringify(this.collection));
    }

    addToCollection(item) {
        // Check if already in collection
        const exists = this.collection.find(i => i.id === item.id);
        if (exists) {
            console.log('Item already in collection');
            return false;
        }

        this.collection.push({
            ...item,
            addedDate: new Date().toISOString()
        });
        this.saveCollection();
        return true;
    }

    removeFromCollection(itemId) {
        this.collection = this.collection.filter(i => i.id !== itemId);
        this.saveCollection();
    }

    getCollection() {
        return this.collection;
    }

    // User Management
    loadUser() {
        const stored = localStorage.getItem('current_user');
        return stored ? JSON.parse(stored) : null;
    }

    login(email, password) {
        // Generic credentials for admin
        if (email === 'admin@discography.ai' && password === 'admin123') {
            this.currentUser = {
                name: 'Admin Central',
                email: email,
                role: 'admin'
            };
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
            window.location.href = '/admin/index.html';
            return true;
        }

        // Generic user login (demo mode)
        this.currentUser = {
            name: email.split('@')[0],
            email: email,
            role: 'user'
        };
        localStorage.setItem('current_user', JSON.stringify(this.currentUser));
        window.location.href = '/home.html';
        return true;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('current_user');
        window.location.href = 'index.html';
    }

    // Statistics & Admin
    trackSearch(query, format) {
        let stats = JSON.parse(localStorage.getItem('search_stats') || '[]');
        stats.push({
            query: query,
            format: format,
            timestamp: new Date().toISOString()
        });
        // Keep only last 1000 searches to prevent localStorage bloat
        if (stats.length > 1000) stats.shift();
        localStorage.setItem('search_stats', JSON.stringify(stats));
    }

    getSearchStats() {
        const stats = JSON.parse(localStorage.getItem('search_stats') || '[]');
        return stats;
    }

    // Role Management
    isAdmin() {
        const user = this.currentUser;
        return user && user.role === 'admin';
    }

    // Utility Methods
    formatPrice(price) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(price);
    }

    showNotification(message, type = 'success') {
        // Simple notification (can be enhanced with a UI library)
        console.log(`[${type.toUpperCase()}]: ${message}`);

        // You can add a toast notification here
        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-6 bg-${type === 'success' ? 'primary' : 'red-500'} text-black px-6 py-3 rounded-xl shadow-lg z-50 font-bold`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.musicApp = new MusicCollectionApp();
});

// Export for use in other scripts
window.MusicCollectionApp = MusicCollectionApp;
