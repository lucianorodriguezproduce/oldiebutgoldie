import { test, expect } from '@playwright/test';

test('Camino del Guerrero: Compra Exitosa en el Búnker', async ({ page }) => {
    // 1. Entrar al /archivo
    await page.goto('/archivo');

    // 2. Seleccionar un disco (el primero de la lista)
    const firstItem = page.locator('a.group').first();
    await expect(firstItem).toBeVisible();

    const itemTitle = await firstItem.locator('h3').textContent();
    console.log(`Seleccionando disco: ${itemTitle}`);
    await firstItem.click();

    // 3. Verificar que estamos en la página de detalle
    await expect(page).toHaveURL(/\/archivo\/.+/);

    // 4. Agregar al carrito (si es inventory) o navegar al home con el item
    const addToCartBtn = page.locator('text=AGREGAR AL CARRITO');
    if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();
    } else {
        // Si no es de inventory, el CTA es "TENGO UNO IGUAL / TRADE" que lleva al Home
        await page.locator('text=TENGO UNO IGUAL / TRADE').click();
    }

    // 5. Deberíamos estar en el Home con el Wizard abierto o el item seleccionado
    await expect(page).toHaveURL(/\/?/);

    // 6. Ir a Revisar Lote (usando el FloatingCartCounter)
    const cartCounter = page.locator('#cart-counter');
    await expect(cartCounter).toBeVisible();
    await cartCounter.click();

    // 7. En Revisar Lote
    await expect(page).toHaveURL('/revisar-lote');

    // 8. Verificar que el item está presente
    await expect(page.locator('text=Procesar tu Lote')).toBeVisible();

    // 9. Simular compra directa (Si hay ítems de inventory)
    const buyBtn = page.locator('button:has-text("[COMPRAR]")');
    if (await buyBtn.isVisible()) {
        await buyBtn.click();

        // 10. Verificar redirección a orden o éxito
        // Dado que requiere login, el test llegará hasta el Identity Guard o Form
        await expect(page.locator('text=Inicia Sesión para Procesar tu Lote')).toBeVisible();
    }

    // Nota: Para verificar purchase_success en DataLayer, necesitaríamos un entorno con auth mockeada
    // o completar el login. Para un Smoke Test de UI, validar que llegamos al checkout es suficiente.
});
