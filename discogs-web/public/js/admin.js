// Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
    const statsContainer = document.getElementById('search-stats-list');
    const totalSearchesEl = document.getElementById('total-searches');
    const trendingQueryEl = document.getElementById('trending-query');
    const notesContainer = document.getElementById('admin-notes-list');
    const eventsContainer = document.getElementById('admin-events-list');

    // Load and render stats
    const renderStats = () => {
        if (!window.musicApp) return;
        const stats = window.musicApp.getSearchStats();

        if (totalSearchesEl) totalSearchesEl.textContent = stats.length;

        // Calculate trending (most frequent query)
        if (trendingQueryEl && stats.length > 0) {
            const counts = stats.reduce((acc, curr) => {
                acc[curr.query] = (acc[curr.query] || 0) + 1;
                return acc;
            }, {});
            const trending = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            trendingQueryEl.textContent = trending;
        }

        if (statsContainer) {
            statsContainer.innerHTML = stats.slice(-5).reverse().map(s => `
                <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl mb-2">
                    <div>
                        <p class="text-sm font-bold text-white">${s.query}</p>
                        <p class="text-[10px] text-gray-400 capitalize">${s.format} • ${new Date(s.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <span class="material-icons-round text-primary text-sm">trending_up</span>
                </div>
            `).join('');
        }
    };

    // Load and render content (Notes & Events)
    const renderContent = () => {
        const notes = JSON.parse(localStorage.getItem('admin_notes') || '[]');
        const events = JSON.parse(localStorage.getItem('admin_events') || '[]');

        if (notesContainer) {
            notesContainer.innerHTML = notes.length > 0 ? notes.map((n, i) => `
                <div class="p-3 bg-surface-card border border-gray-800 rounded-xl mb-2 flex justify-between items-start">
                    <div>
                        <h4 class="text-sm font-bold text-white">${n.title}</h4>
                        <p class="text-xs text-gray-400">${n.content}</p>
                    </div>
                    <button onclick="deleteNote(${i})" class="text-gray-500 hover:text-red-500"><span class="material-icons-round text-sm">delete</span></button>
                </div>
            `).join('') : '<p class="text-xs text-gray-500 text-center py-4">No hay notas cargadas</p>';
        }

        if (eventsContainer) {
            eventsContainer.innerHTML = events.length > 0 ? events.map((e, i) => `
                <div class="p-3 bg-surface-card border border-gray-800 rounded-xl mb-2 flex justify-between items-start">
                    <div>
                        <h4 class="text-sm font-bold text-white">${e.name}</h4>
                        <p class="text-xs text-gray-400">${e.date} • ${e.location}</p>
                    </div>
                    <button onclick="deleteEvent(${i})" class="text-gray-500 hover:text-red-500"><span class="material-icons-round text-sm">delete</span></button>
                </div>
            `).join('') : '<p class="text-xs text-gray-500 text-center py-4">No hay eventos próximos</p>';
        }
    };

    // Exposé cleanup functions to global scope for onclick handlers
    window.deleteNote = (index) => {
        let notes = JSON.parse(localStorage.getItem('admin_notes') || '[]');
        notes.splice(index, 1);
        localStorage.setItem('admin_notes', JSON.stringify(notes));
        renderContent();
    };

    window.deleteEvent = (index) => {
        let events = JSON.parse(localStorage.getItem('admin_events') || '[]');
        events.splice(index, 1);
        localStorage.setItem('admin_events', JSON.stringify(events));
        renderContent();
    };

    window.addNote = () => {
        const title = prompt('Título de la nota:');
        const content = prompt('Contenido:');
        if (title && content) {
            let notes = JSON.parse(localStorage.getItem('admin_notes') || '[]');
            notes.push({ title, content, date: new Date().toISOString() });
            localStorage.setItem('admin_notes', JSON.stringify(notes));
            renderContent();
        }
    };

    window.addEvent = () => {
        const name = prompt('Nombre del evento:');
        const date = prompt('Fecha:');
        const location = prompt('Ubicación:');
        if (name && date && location) {
            let events = JSON.parse(localStorage.getItem('admin_events') || '[]');
            events.push({ name, date, location });
            localStorage.setItem('admin_events', JSON.stringify(events));
            renderContent();
        }
    };

    // Initial render
    setTimeout(() => {
        renderStats();
        renderContent();
    }, 100);
});
