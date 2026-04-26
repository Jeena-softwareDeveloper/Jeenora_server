const mongoose = require('mongoose');
require('dotenv').config();
const WearProduct = require('./models/wear/wearProductModel');

mongoose.connect(process.env.DB_URL).then(async () => {
    const sellerObjectId = new mongoose.Types.ObjectId('69ec8fe5821b5bef49d9b0a6');
    const groupedCatalogs = await WearProduct.aggregate([
        { $match: { sellerId: sellerObjectId } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: { 
                    $cond: { 
                        if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                        then: "$_id", 
                        else: "$catalogId" 
                    } 
                },
                mainProduct: { $first: "$$ROOT" },
                allProducts: { $push: "$$ROOT" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "mainProduct.createdAt": -1 } }
    ]);
    
    console.log(`Found ${groupedCatalogs.length} catalogs.`);
    groupedCatalogs.forEach(g => {
        console.log(`- Catalog: ${g.mainProduct.productName} (ID: ${g._id}, Count: ${g.count})`);
    });
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
