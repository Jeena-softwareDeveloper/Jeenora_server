const mongoose = require('mongoose');
require('dotenv').config();
const WearProduct = require('./models/wear/wearProductModel');

mongoose.connect(process.env.DB_URL).then(async () => {
    const sellerObjectId = new mongoose.Types.ObjectId('69ec8fe5821b5bef49d9b0a6');
    const groupedCatalogs = await WearProduct.aggregate([
        { $match: { sellerId: sellerObjectId } },
        {
            $group: {
                _id: { 
                    $cond: { 
                        if: { $or: [
                            { $eq: ["$catalogId", null] }, 
                            { $eq: ["$catalogId", ""] },
                            { $not: ["$catalogId"] }
                        ] }, 
                        then: "$_id", 
                        else: "$catalogId" 
                    } 
                },
                count: { $sum: 1 },
                products: { $push: { name: "$productName", id: "$_id" } }
            }
        }
    ]);
    console.log(JSON.stringify(groupedCatalogs, null, 2));
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
