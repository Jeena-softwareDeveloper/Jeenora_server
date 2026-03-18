const MarketPrice = require('../../models/Awareness/marketPriceModel');
const { responseReturn } = require('../../utiles/response');

class MarketPriceController {
    
    // Get latest prices
    get_latest_prices = async (req, res) => {
        try {
            const prices = await MarketPrice.find().sort({ updatedAt: -1 }).limit(10);
            return responseReturn(res, 200, { prices });
        } catch (error) {
            return responseReturn(res, 500, { error: 'Internal Server Error' });
        }
    }

    // Add/Seed (Internal use)
    seed_prices = async (req, res) => {
        try {
            await MarketPrice.deleteMany({});
            const items = [
                { cropName: 'Tomato', price: 45, unit: 'kg', change: 2.5 },
                { cropName: 'Paddy (Rice)', price: 22, unit: 'kg', change: -0.5 },
                { cropName: 'Turmeric', price: 11500, unit: 'quintal', change: 120 },
                { cropName: 'Onion', price: 32, unit: 'kg', change: 4.2 },
                { cropName: 'Chilli', price: 180, unit: 'kg', change: -1.5 },
                { cropName: 'Cotton', price: 7200, unit: 'quintal', change: 50 }
            ];
            await MarketPrice.insertMany(items);
            return responseReturn(res, 201, { message: 'Prices seeded' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new MarketPriceController();
