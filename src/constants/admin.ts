// Constante centralizada del UID del administrador para evitar mismatches
export const ADMIN_UID = 'MKPlxxi9JENQt0hS3V1QNeF8oOS2';

// Correos electrónicos autorizados como administradores
export const ADMIN_EMAILS = [
    'admin@discography.ai',
    'lucianorodriguez.produce@gmail.com'
];

/**
 * Verifica si un correo electrónico pertenece a la lista de administradores
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
}
