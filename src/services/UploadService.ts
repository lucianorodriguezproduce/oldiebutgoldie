/**
 * Utility service to handle file upload preparations,
 * specifically sanitizing filenames for cross-platform compatibility.
 */
export const sanitizeFileName = (fileName: string): string => {
    // 1. Remove extension to sanitize name separately
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex).toLowerCase() : '';

    // 2. Normalize and remove accents/tildes
    const sanitized = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Spaces to dashes
        .replace(/[^a-z0-0\-_]/g, '')   // Remove special characters except dashes and underscores
        .replace(/-+/g, '-')            // Collapse multiple dashes
        .replace(/^-+|-+$/g, '');       // Trim leading/trailing dashes

    return `${sanitized}${extension}`;
};

export const UploadService = {
    sanitizeFileName
};
