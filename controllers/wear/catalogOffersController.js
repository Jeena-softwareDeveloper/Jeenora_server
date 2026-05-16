const WearProduct = require('../../models/wear/WearProduct');
const Product = require('../../models/wear/Product');
const { responseReturn } = require('../../utils/response');

class CatalogOffersController {
    update_catalog_offers = async (req, res) => {
        const { productId } = req.params;
        const { offers } = req.body; // Array of Offer ObjectIds

        try {
            // Check in WearProduct
            let productToUpdate = await WearProduct.findById(productId);
            if (productToUpdate) {
                // To apply offers to all similar styles in the same group catalog
                await WearProduct.updateMany(
                    { catalogId: productToUpdate.catalogId },
                    { $set: { offers } }
                );
                return responseReturn(res, 200, { message: 'Offers linked to Wear product catalog successfully' });
            }

            // Check in Legacy Product
            productToUpdate = await Product.findById(productId);
            if (productToUpdate) {
                productToUpdate.offers = offers;
                await productToUpdate.save();
                return responseReturn(res, 200, { message: 'Offers linked to Legacy product successfully' });
            }

            return responseReturn(res, 404, { error: 'Product not found' });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new CatalogOffersController();
