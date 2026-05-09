const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const orderController = require('../controllers/wear/orderController');

// Mock Express response
const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.data = data; console.log('Response:', JSON.stringify(data, null, 2)); return this; }
};

const simulateOrder = async () => {
    console.log('🛒 Simulating Order Placement...');
    
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to DB');

    const userId = "690d9df6660ff41ae19956a6"; 
    const productId = "699c86360c237322c77c0bc8";

    const mockBody = {
        userId,
        price: 709,
        shipping_fee: 50,
        payment_method: 'COD',
        shippingInfo: {
            name: "Test Customer",
            phone: "9123456789",
            houseNo: "45",
            area: "Green Garden",
            city: "Erode",
            state: "Tamil Nadu",
            pincode: "638052" 
        },
        products: [
            {
                sellerId: "699c74650c237322c77c09c4", 
                price: 709,
                products: [
                    {
                        productInfo: {
                            _id: productId,
                            productName: "Allensolly Mens polo tshirt",
                            price: 709,
                            discount: 0,
                            variants: [{ size: "L", stock: 40 }]
                        },
                        quantity: 1,
                        size: "L"
                    }
                ]
            }
        ]
    };

    const req = { body: mockBody, id: userId };

    try {
        await orderController.place_order(req, res);
    } catch (err) {
        console.error('Order simulation failed:', err);
    } finally {
        // Wait a bit for async tasks (Shiprocket sync) to log
        setTimeout(() => {
            mongoose.connection.close();
            process.exit();
        }, 10000);
    }
};

simulateOrder();
