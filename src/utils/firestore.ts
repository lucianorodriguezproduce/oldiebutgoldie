/**
 * Recurre el objeto y elimina todas las propiedades 'undefined',
 * las cuales Firebase no soporta al guardar documentos.
 * 
 * NOTA: Solo procesa objetos planos y arrays para evitar corromper
 * objetos internos de Firebase (como FieldValue de serverTimestamp o arrayUnion).
 */
export const scrubData = (data: any): any => {
    // 1. Primitivos y nulos: retornar tal cual
    if (data === null || typeof data !== 'object') {
        return data;
    }

    // 2. Identificar si es un objeto plano (literal)
    // Los objetos de Firebase (Timestamp, FieldValue, etc) NO son objetos planos.
    const isPlainObject = Object.prototype.toString.call(data) === '[object Object]' && 
                         (data.constructor === Object || data.constructor === undefined);

    // 3. Si no es un objeto plano y tampoco es un array, es un objeto "especial" (Clase, Timestamp, Ref)
    // Estos deben retornarse sin ser procesados para no romper sus métodos internos.
    if (!isPlainObject && !Array.isArray(data)) {
        return data;
    }

    // 4. Procesamiento de Arrays
    if (Array.isArray(data)) {
        return data.map(item => scrubData(item));
    }

    // 5. Procesamiento de Objetos Planos (Recursión para eliminar undefined)
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value !== undefined) {
            cleaned[key] = scrubData(value);
        }
    });

    return cleaned;
};
