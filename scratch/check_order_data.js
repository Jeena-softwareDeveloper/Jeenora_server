const mongoose = require('mongoose');
const authOrderModel = require('../models/wear/authOrder');
require('dotenv').config();

mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        const order = await authOrderModel.findOne({});
        console.log("Sample Order:", JSON.stringify(order, null, 2));
        
        const Supplier = require('../models/wear/supplierModel');
        const supplier = await Supplier.findOne({ _id: order.sellerId });
        console.log("Supplier:", JSON.stringify(supplier, null, 2));
        
        process.exit(0);
    })
    .catch(console.log);
