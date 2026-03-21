const fs = require('fs');
const path = require('path');

const adminGearPath = path.join(__dirname, '../src/pages/Admin/AdminGear.tsx');
let content = fs.readFileSync(adminGearPath, 'utf8');

// 1. Rename Component and remove Discogs logic
content = content.replace(/export default function AdminInventory/g, 'export default function AdminGear');
content = content.replace(/import { discogsService }.*\n/g, '');
content = content.replace(/import type { DiscogsSearchResult }.*\n/g, '');
content = content.replace(/import ItemConfigModal.*\n/g, '');
content = content.replace(/import { CompactSearchCard }.*\n/g, '');

// 2. Adjust Services
content = content.replace(/import { inventoryService, getInventoryPaged } from "@\/services\/inventoryService";/g, 'import { gearService, getGearPaged } from "@/services/gearService";');
content = content.replace(/inventoryService/g, 'gearService');
content = content.replace(/getInventoryPaged/g, 'getGearPaged');

// 3. UI Text Replacements
content = content.replace(/Inventario Pro/g, 'Búnker de Equipos');
content = content.replace(/Gestión avanzada de la base de datos soberana\./g, 'Gestión avanzada del hardware y equipos premium.');
content = content.replace(/Sincronizando Inventario Soberano/g, 'Sincronizando Hardware...');

// 4. Form Field Replacements
content = content.replace(/Título del Disco/g, 'Modelo / Nombre del Ítem');
content = content.replace(/Artista \/ Banda/g, 'Marca / Fabricante');
content = content.replace(/Categoría Interna Objetiva/g, 'Categoría de Equipo Interna');
content = content.replace(/Format: "Vinyl"/g, 'Format: "Hardware"');

// 5. Hardcode Manual Mode & remove Discogs search JSX
// Find the "ingestionMode" block and replace it entirely with just the manual form.
const ingestionRegex = /<div className="flex items-center justify-between">[\s\S]*?\{ingestionMode === "discogs" \? \([\s\S]*?\) : \(/;
content = content.replace(ingestionRegex, `<div className="flex items-center justify-between mb-6">
    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Nuevo Equipo Mapeado</h3>
</div>
<div className="space-y-6">`);

// Remove the closing tags from the ingestionMode ternary
const closingRegex = /<\button>\s*<\/div>\s*\)\}\s*<\/motion\.div>/;
content = content.replace(closingRegex, `</button>\n                                </div>\n                        </motion.div>`);

// Fix missing dependencies and unused variables (rough pass, tsx will complain but it's a start)
content = content.replace(/const \[ingestionMode.*\n/g, '');
content = content.replace(/const \[discogsId.*\n/g, '');
content = content.replace(/const \[showConfigModal.*\n/g, '');
content = content.replace(/const \[ingestionQuery.*\n/g, '');
content = content.replace(/const \[ingestionResults.*\n/g, '');
content = content.replace(/const \[isSearchingIngestion.*\n/g, '');
content = content.replace(/const \[selectedSearchItem.*\n/g, '');
content = content.replace(/const debouncedIngestionQuery.*\n/g, '');

fs.writeFileSync(adminGearPath, content);
console.log('AdminGear.tsx refactored.');

// 6. Create gearService.ts
const inventoryServicePath = path.join(__dirname, '../src/services/inventoryService.ts');
const gearServicePath = path.join(__dirname, '../src/services/gearService.ts');

let serviceContent = fs.readFileSync(inventoryServicePath, 'utf8');
serviceContent = serviceContent.replace(/export const inventoryService/g, 'export const gearService');
serviceContent = serviceContent.replace(/export const getInventoryPaged/g, 'export const getGearPaged');
serviceContent = serviceContent.replace(/COLLECTION_NAME = "inventory"/g, 'COLLECTION_NAME = "hardware_inventory"');
// Change ID prefix to EQP
serviceContent = serviceContent.replace(/idService\.generateInternalID\('VTA'\)/g, "idService.generateInternalID('EQP')");

fs.writeFileSync(gearServicePath, serviceContent);
console.log('gearService.ts created from inventoryService.ts.');
