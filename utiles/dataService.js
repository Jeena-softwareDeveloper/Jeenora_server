const fs = require('fs');
const path = require('path');

/**
 * Persists module data to a JSON file on the server.
 * This satisfies the "server la file wright panu" requirement.
 */
const writeDataToFile = (moduleName, data) => {
    try {
        const dir = path.join(__dirname, '../config/data');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const filePath = path.join(dir, `${moduleName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
        console.log(`[DATA_SERVICE] Snapshot saved for ${moduleName} at ${filePath}`);
    } catch (error) {
        console.error(`[DATA_SERVICE] Write Error for ${moduleName}:`, error.message);
    }
};

/**
 * Loads module data from the server JSON file as a fallback.
 */
const readDataFromFile = (moduleName) => {
    try {
        const filePath = path.join(__dirname, `../config/data/${moduleName}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.error(`[DATA_SERVICE] Read Error for ${moduleName}:`, error.message);
    }
    return null;
};

module.exports = { writeDataToFile, readDataFromFile };
