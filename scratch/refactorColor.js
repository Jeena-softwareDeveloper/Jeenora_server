const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'c:/Users/jeena/Downloads/Jeenora_Projcts/Jeenora_server/controllers/wear/wearCatalogController.js',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/Jeenora_server/controllers/wear/homeControllers.js',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/Jeenora_server/controllers/wear/supplierStockController.js',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/Jeenora_server/controllers/wear/wearCartController.js',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/jeenora_ecommerce/src/pages/SupplierCatalogUpload/SupplierCatalogUpload.jsx',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/jeenora_ecommerce/src/pages/ProductDetail/ProductDetail.jsx',
    'c:/Users/jeena/Downloads/Jeenora_Projcts/jeenora_ecommerce/src/components/common/ProductCard.jsx'
];

for (const filePath of filesToUpdate) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Target specific patterns to avoid renaming genuine CSS colors
        content = content.replace(/\.color/g, '.variantName');
        content = content.replace(/color:/g, 'variantName:');
        content = content.replace(/Color /g, 'Variant Name ');
        content = content.replace(/color ===/g, 'variantName ===');
        content = content.replace(/\{ color \}/g, '{ variantName }');
        content = content.replace(/\{ color,/g, '{ variantName,');
        content = content.replace(/, color \}/g, ', variantName }');
        
        // specific fixes
        content = content.replace(/addProductColor/g, 'addProductVariant');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    } else {
        console.log(`File not found: ${filePath}`);
    }
}
