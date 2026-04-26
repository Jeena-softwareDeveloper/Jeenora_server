const mongoose = require('mongoose');
require('dotenv').config();
const WearProduct = require('./models/wear/wearProductModel');
const Product = require('./models/wear/productModel');

mongoose.connect(process.env.DB_URL).then(async () => {
    const sellerObjectId = new mongoose.Types.ObjectId('69ec8fe5821b5bef49d9b0a6');
    
    // Wear Products (New System)
    const wpCount = await WearProduct.countDocuments({ sellerId: sellerObjectId });
    
    // Grouped Catalogs (New System)
    const groupedWP = await WearProduct.aggregate([
        { $match: { sellerId: sellerObjectId } },
        { 
            $group: { 
                _id: { 
                    $cond: { 
                        if: { $or: [{ $eq: ["$catalogId", null] }, { $eq: ["$catalogId", ""] }, { $not: ["$catalogId"] }] }, 
                        then: "$_id", 
                        else: "$catalogId" 
                    } 
                } 
            } 
        }
    ]);
    
    // Legacy Products
    const lpCount = await Product.countDocuments({ sellerId: sellerObjectId });
    
    console.log('--- Catalog Stats for 78i88 ---');
    console.log('Total Wear Products:', wpCount);
    console.log('Total Wear Catalogs (Grouped):', groupedWP.length);
    console.log('Total Legacy Products:', lpCount);
    console.log('Total Visible Catalogs:', groupedWP.length + lpCount);
    
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
