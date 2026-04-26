const axios = require('axios');
const { responseReturn } = require("../../utiles/response");
const productModel = require('../../models/wear/wearProductModel');
const supplierModel = require('../../models/wear/supplierModel');
const shiprocketService = require("../../utiles/shiprocketService");

class deliveryController {
    // 1. Get Pincode from Latitude and Longitude
    get_pincode_from_location = async (req, res) => {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return responseReturn(res, 400, { error: 'Latitude and Longitude are required' });
        }

        try {
            // Using OpenStreetMap Nominatim (Free)
            const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
                params: {
                    format: 'jsonv2',
                    lat: lat,
                    lon: lng,
                },
                headers: {
                    'User-Agent': 'Jeenora-App' // Nominatim requires a user agent
                }
            });

            if (response.data && response.data.address) {
                const { postcode, city, state, suburb, road } = response.data.address;
                const display_name = response.data.display_name;

                return responseReturn(res, 200, {
                    pincode: postcode || '',
                    city: city || suburb || '',
                    state: state || '',
                    address: display_name,
                    success: true
                });
            }

            return responseReturn(res, 404, { error: 'Location not found' });

        } catch (error) {
            console.error('❌ Reverse Geocoding Error:', error.message);
            return responseReturn(res, 500, { error: 'Failed to fetch location details' });
        }
    }

    // 2. Get EDD from Pincode (Existing)
    get_delivery_edd = async (req, res) => {
        const { productId, deliveryPincode } = req.query;

        console.log(`🚚 Fetching EDD for Product: ${productId}, Pincode: ${deliveryPincode}`);

        if (!productId || !deliveryPincode) {
            return responseReturn(res, 400, { error: 'Product ID and Pincode are required' });
        }

        try {
            // 1. Get Product
            const product = await productModel.findById(productId);
            if (!product) {
                return responseReturn(res, 404, { error: 'Product not found' });
            }

            // 2. Get Seller/Supplier Pincode
            const supplier = await supplierModel.findById(product.sellerId);
            if (!supplier || !supplier.addressDetails?.pincode) {
                // If no supplier pincode, fallback to a default (usually warehouse or common hub)
                console.log('⚠️ Supplier pincode not found, using default');
            }

            const pickupPincode = supplier?.addressDetails?.pincode || process.env.SHIPROCKET_DEFAULT_PICKUP_PINCODE || '624001';

            // 3. Call Shiprocket
            const edd = await shiprocketService.getEDD(pickupPincode, deliveryPincode);

            if (edd) {
                return responseReturn(res, 200, { 
                    edd, 
                    success: true,
                    pickupPincode,
                    deliveryPincode,
                    sellerCity: supplier?.addressDetails?.city || 'Seller Location'
                });
            } else {
                // Fallback: 7 days from now
                const fallbackDate = new Date();
                fallbackDate.setDate(fallbackDate.getDate() + 7);
                return responseReturn(res, 200, { 
                    edd: fallbackDate.toISOString(), 
                    isFallback: true,
                    success: true,
                    sellerCity: supplier?.addressDetails?.city || 'Seller Location'
                });
            }

        } catch (error) {
            console.error('❌ EDD Controller Error:', error.message);
            // Fallback: 7 days from now
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() + 7);
            return responseReturn(res, 200, { 
                edd: fallbackDate.toISOString(), 
                isFallback: true,
                success: true 
            });
        }
    }
}

module.exports = new deliveryController();
