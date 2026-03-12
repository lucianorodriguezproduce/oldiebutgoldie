/**
 * Recurre el objeto y elimina todas las propiedades 'undefined',
 * las cuales Firebase no soporta al guardar documentos.
 */
export const scrubData = (data: any): any => {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    // Preservar objetos especiales de Firestore (Timestamps, etc)
    // Usualmente tienen un método toDate o una estructura específica
    if ('_methodName' in data || (data.constructor && data.constructor.name === 'Timestamp')) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => scrubData(item));
    }

    const cleaned: any = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value !== undefined) {
            cleaned[key] = scrubData(value);
        }
    });

    return cleaned;
};
