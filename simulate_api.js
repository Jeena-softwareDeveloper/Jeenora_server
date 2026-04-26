const mongoose = require('mongoose');
require('dotenv').config();
const WearProduct = require('./models/wear/wearProductModel');
const Supplier = require('./models/wear/supplierModel');
const controller = require('./controllers/wear/wearCatalogController');

mongoose.connect(process.env.DB_URL).then(async () => {
    const req = {
        id: '69ec643d508cd409af50153f' // User ID for jeena12
    };
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log('Status Code:', code);
                console.log('Total Catalogs:', data.catalogs ? data.catalogs.length : 0);
                if (data.catalogs) {
                    data.catalogs.forEach(c => {
                        console.log(`- ${c.productName} (ID: ${c._id}, catalogId: ${c.catalogId}, Status: ${c.status})`);
                    });
                }
                process.exit();
            }
        })
    };
    
    await controller.get_my_catalogs(req, res);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
