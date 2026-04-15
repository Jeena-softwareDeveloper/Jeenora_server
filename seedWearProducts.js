const mongoose = require('mongoose');
const WearProduct = require('./models/wear/wearProductModel');
const Supplier = require('./models/wear/supplierModel');
const WearBuyer = require('./models/wear/wearBuyerModel');
require('dotenv').config();

const products = [
    {
        productName: "Silk Kanjeevaram Saree",
        description: "Elegant silk saree with gold zari work, perfect for weddings and special occasions. Hand-woven by traditional artisans.",
        miniDescription: "Hand-woven Silk Saree with Gold Zari",
        category: "Sarees",
        subCategory: "Kanjeevaram",
        attributes: [{ name: "Gender", value: "Women" }],
        images: ["https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/silk-saree-1.jpg"],
        variants: [{
            size: "Free Size",
            color: "Deep Red",
            listingPrice: 4500,
            mrp: 8500,
            stock: 50,
            skuId: "SILK-KAN-RED-001"
        }],
        status: "active",
        isPrimary: true
    },
    {
        productName: "Cotton Printed Kurti",
        description: "Comfortable daily wear cotton kurti with floral patterns. Breathable fabric and vibrant colors.",
        miniDescription: "Daily Wear Cotton Kurti",
        category: "Kurtis",
        subCategory: "Cotton",
        attributes: [{ name: "Gender", value: "Women" }],
        images: ["https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/kurti-1.jpg"],
        variants: [{
            size: "M",
            color: "Blue",
            listingPrice: 850,
            mrp: 1200,
            stock: 100,
            skuId: "COT-KUR-BLU-M"
        }, {
            size: "L",
            color: "Blue",
            listingPrice: 850,
            mrp: 1200,
            stock: 80,
            skuId: "COT-KUR-BLU-L"
        }],
        status: "active"
    },
    {
        productName: "Designer Salwar Kameez",
        description: "Exquisite designer salwar suit with heavy embroidery. Includes dupatta and matching bottom.",
        miniDescription: "Embroidered Salwar Suit Set",
        category: "Suits",
        subCategory: "Salwar Kameez",
        attributes: [{ name: "Gender", value: "Women" }],
        images: ["https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/suit-1.jpg"],
        variants: [{
            size: "XL",
            color: "Emerald Green",
            listingPrice: 2200,
            mrp: 4500,
            stock: 30,
            skuId: "DES-SUIT-GRN-XL"
        }],
        status: "active"
    },
    {
        productName: "Fancy Party Wear Saree",
        description: "Modern georgette saree with sequin work. Lightweight and stylish for parties.",
        miniDescription: "Georgette Sequin Saree",
        category: "Sarees",
        subCategory: "Georgette",
        attributes: [{ name: "Gender", value: "Women" }],
        images: ["https://res.cloudinary.com/dxh6gsda4/image/upload/v1711964100/samples/ecommerce/saree-2.jpg"],
        variants: [{
            size: "Free Size",
            color: "Black",
            listingPrice: 1500,
            mrp: 3000,
            stock: 45,
            skuId: "FAN-SAR-BLK-001"
        }],
        status: "active",
        isFeatured: true
    }
];

const seedProducts = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('✅ Database connected');

        // 1. Ensure a dummy Buyer exists (for the Supplier)
        let buyer = await WearBuyer.findOne({ phone: "9876543210" });
        if (!buyer) {
            buyer = await WearBuyer.create({
                name: "Seed Supplier User",
                phone: "9876543210",
                email: "supplier@jeenora.com",
                isVerified: true,
                role: "wear_buyer"
            });
            console.log('✅ Created dummy Buyer');
        }

        // 2. Ensure a dummy Supplier exists
        let supplier = await Supplier.findOne({ "supplierDetails.email": "supplier@jeenora.com" });
        if (!supplier) {
            supplier = await Supplier.create({
                user: buyer._id,
                businessDetails: {
                    shopName: "Jeenora Plus Official Store",
                    businessType: "Manufacturer",
                    hasGst: true,
                    gstNumber: "22AAAAA0000A1Z5"
                },
                supplierDetails: {
                    fullName: "Jeena Seed",
                    email: "supplier@jeenora.com",
                    phone: "9876543210"
                },
                status: "approved"
            });
            console.log('✅ Created dummy Supplier');
        }

        // 3. Clear existing seed products if needed (Optional: uncomment to reset)
        // await WearProduct.deleteMany({ sellerId: supplier._id });

        // 4. Insert Products
        const formattedProducts = products.map(p => ({
            ...p,
            sellerId: supplier._id,
            catalogId: "CAT-" + Math.random().toString(36).substr(2, 9).toUpperCase()
        }));

        for (const prod of formattedProducts) {
          // Use findOneAndUpdate with upsert to avoid duplicate SKU errors on re-run
          await WearProduct.findOneAndUpdate(
            { productName: prod.productName }, 
            prod, 
            { upsert: true, new: true }
          );
        }

        console.log(`✅ ${products.length} products seeded/updated successfully`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding products:', error);
        process.exit(1);
    }
};

seedProducts();
