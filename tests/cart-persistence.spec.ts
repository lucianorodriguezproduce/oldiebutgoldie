import { test, expect } from '@playwright/test';

test('Persistencia de Batea: Los ítems sobreviven al refresh', async ({ page }) => {
    // 1. Entrar al home o archivo
    await page.goto('/archivo');

    // 2. Limpiar batea previa para asegurar test limpio (vía consola del navegador)
    await page.evaluate(() => localStorage.removeItem('stitch_lote'));
    await page.reload();

    // 3. Seleccionar un disco y entrar al detalle
    const firstItem = page.locator('a.group').first();
    await firstItem.click();

    // 4. Añadir al lote (Batea)
    // Usamos el texto del botón que sea visible
    const addBtn = page.locator('text=AGREGAR AL CARRITO');
    if (await addBtn.isVisible()) {
        await addBtn.click();
    } else {
        await page.locator('text=TENGO UNO IGUAL / TRADE').click();
    }

    // 5. Verificar que el contador del carrito muestra "1"
    const cartCounter = page.locator('#cart-counter');
    await expect(cartCounter).toContainText('1');

    // 6. Refrescar la página
    await page.reload();

    // 7. Verificar que el contador SIGUE mostrando "1" (Persistencia)
    await expect(cartCounter).toContainText('1');

    // 8. Verificar localStorage directamente
    const lote = await page.evaluate(() => localStorage.getItem('stitch_lote'));
    expect(lote).not.toBeNull();
    const items = JSON.parse(lote!);
    expect(items.length).toBeGreaterThan(0);
});
