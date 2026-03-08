const fs = require('fs');
const path = require('path');

const directory = 'src';

// The terms to map.
// We only map user-facing strings, avoiding variable names like is_bunker_item or bunkerToLegacy unless we want to change them.
// The user asked to remove the old terminology. We will replace the text but we should be careful with code logic.
const replacements = [
    { regex: /Búnker/gi, replace: 'La Batea' },
    { regex: /bunker(?![_A-Za-z0-9])/gi, replace: 'batea' }, // Only match whole word or if it's not part of a variable like is_bunker
    { regex: /Gladiador/gi, replace: 'Coleccionista' },
    { regex: /Arsenal/gi, replace: 'Catálogo' },
    { regex: /Armamento/gi, replace: 'Batea' },
    { regex: /Guerra/gi, replace: 'Historia' },
    { regex: /Expediente/gi, replace: 'Ficha Técnica' },
    { regex: /Stitch Match/gi, replace: 'OBG Match' },
    { regex: /Stitch/gi, replace: 'OBG' }
];

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(directory, function (filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        replacements.forEach(r => {
            content = content.replace(r.regex, r.replace);
        });

        // We also want to rename the variables if needed, but the user said "purga global" and "eliminar cualquier rastro". Let's also do variables.
        content = content.replace(/is_bunker_/g, 'is_obg_');
        content = content.replace(/bunkerToLegacy/g, 'obgToLegacy');
        content = content.replace(/bunker_/g, 'obg_');

        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Updated', filePath);
        }
    }
});
