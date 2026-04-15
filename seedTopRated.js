const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.ObjectId, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    category: { type: String, required: true },
    brand: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    discount: { type: Number, required: true },
    description: { type: String, required: true },
    shopName: { type: String, required: true },
    images: { type: Array, required: true },
    rating: { type: Number, default: 0 },
    status: { type: String, default: 'active' }
}, { timestamps: true });

const Product = mongoose.model('products', productSchema);

const seedProducts = [
    {
        name: "Premium Silk Embellished Kurti",
        slug: "premium-silk-kurti-" + Date.now(),
        category: "Kurtis",
        brand: "JEENORA LUXE",
        price: 1299,
        stock: 50,
        discount: 15,
        description: "Exquisite hand-worked silk kurti for special occasions.",
        shopName: "Jeenora Official",
        images: ["https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"],
        rating: 4.9,
        sellerId: "6986d37bc98bac524d5ce2d6",
        status: 'active'
    },
    {
        name: "Handcrafted Silver Jhumkas",
        slug: "silver-jhumkas-" + Date.now(),
        category: "Jewellery",
        brand: "JEENORA CRAFTS",
        price: 899,
        stock: 100,
        discount: 5,
        description: "Traditional silver jhumkas with intricate artistry.",
        shopName: "CraftHouse",
        images: ["https://images.unsplash.com/photo-1621607512214-68297480165e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"],
        rating: 5.0,
        sellerId: "6986d37bc98bac524d5ce2d6",
        status: 'active'
    },
    {
        name: "Embroidered Velvet Potli Bag",
        slug: "velvet-potli-" + Date.now(),
        category: "Accessories",
        brand: "JEENORA LUXE",
        price: 599,
        stock: 60,
        discount: 10,
        description: "Luxurious velvet potli with golden embroidery.",
        shopName: "Jeenora Official",
        images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"],
        rating: 4.6,
        sellerId: "6986d37bc98bac524d5ce2d6",
        status: 'active'
    },
    {
        name: "Designer Floral Suit Set",
        slug: "floral-suit-" + Date.now(),
        category: "Suits",
        brand: "PURE ORGANICS",
        price: 2499,
        stock: 30,
        discount: 12,
        description: "Sustainable organic cotton with beautiful hand-block prints.",
        shopName: "EcoStore",
        images: ["https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"],
        rating: 4.8,
        sellerId: "6986d37bc98bac524d5ce2d6",
        status: 'active'
    },
    {
        name: "Silk Zari Work Saree",
        slug: "zari-saree-" + Date.now(),
        category: "Sarees",
        brand: "JEENORA TRENDS",
        price: 4200,
        stock: 15,
        discount: 20,
        description: "Elegant silk saree with gold zari work.",
        shopName: "Jeenora Official",
        images: ["https://images.unsplash.com/photo-1610030469668-935142b96ed4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"],
        rating: 4.7,
        sellerId: "6986d37bc98bac524d5ce2d6",
        status: 'active'
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.DB_URL || 'mongodb://127.0.0.1:27017/shop');
        console.log('Connected to DB for re-seeding...');
        
        // Remove individual duplicates if they exist
        for (const item of seedProducts) {
            await Product.deleteOne({ name: item.name });
        }
        
        await Product.insertMany(seedProducts);
        console.log('Successfully re-seeded 5 top-rated products with working images!');
        
        process.exit();
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
