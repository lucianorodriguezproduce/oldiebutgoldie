export const formatDate = (date: any) => {
    if (!date) return "N/A";

    // Handle Firebase Timestamp
    let d = date;
    if (date.seconds) {
        d = new Date(date.seconds * 1000);
    } else if (!(date instanceof Date)) {
        d = new Date(date);
    }

    if (isNaN(d.getTime())) return "N/A";

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    // Relative time logic
    if (diffInSeconds < 60) return "Hace un momento";
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} h`;

    // Absolute time logic
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(d);
};

export const getReadableDate = (ts: any) => {
    if (!ts) return "Pendiente de sincronización";
    try {
        let date: Date;
        if (typeof ts.toDate === 'function') {
            date = ts.toDate();
        } else if (ts.seconds) {
            date = new Date(ts.seconds * 1000);
        } else if (ts instanceof Date) {
            date = ts;
        } else {
            const parsed = new Date(ts);
            if (isNaN(parsed.getTime())) return "Pendiente de sincronización";
            date = parsed;
        }

        if (isNaN(date.getTime())) return "Pendiente de sincronización";

        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error("Error formatting date:", error);
        return "Pendiente de sincronización";
    }
};
