const addressModel = require("../../models/customer/addressModel");
const { responseReturn } = require("../../utils/response");

class addressController {
    get_addresses = async (req, res) => {
        const { id } = req;
        try {
            const addresses = await addressModel.find({ userId: id }).sort({ createdAt: -1 });
            responseReturn(res, 200, { addresses });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    add_address = async (req, res) => {
        const { id } = req;
        const { name, phone, pincode, state, city, houseNo, area, landmark, type, isDefault } = req.body;
        try {
            if (isDefault) {
                await addressModel.updateMany({ userId: id }, { isDefault: false });
            }

            const address = await addressModel.create({
                userId: id,
                name, phone, pincode, state, city, houseNo, area, landmark, type, isDefault
            });
            responseReturn(res, 201, { address, message: 'Address added successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_address = async (req, res) => {
        const { addressId } = req.params;
        const { id } = req;
        try {
            if (req.body.isDefault) {
                await addressModel.updateMany({ userId: id }, { isDefault: false });
            }

            const address = await addressModel.findByIdAndUpdate(addressId, req.body, { new: true });
            responseReturn(res, 200, { address, message: 'Address updated successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    delete_address = async (req, res) => {
        const { addressId } = req.params;
        try {
            await addressModel.findByIdAndDelete(addressId);
            responseReturn(res, 200, { message: 'Address deleted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_address_by_id = async (req, res) => {
        const { addressId } = req.params;
        try {
            const address = await addressModel.findById(addressId);
            if (!address) {
                return responseReturn(res, 404, { error: 'Address not found' });
            }
            responseReturn(res, 200, { address });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_all_addresses_admin = async (req, res) => {
        try {
            // Get all addresses and group them by userId
            const allAddresses = await addressModel.find({})
                .populate('userId', 'name email image')
                .sort({ updatedAt: -1 });

            // Grouping logic
            const grouped = allAddresses.reduce((acc, current) => {
                const user = current.userId;
                if (!user) return acc;

                const userIdStr = user._id.toString();
                if (!acc[userIdStr]) {
                    acc[userIdStr] = {
                        user: user,
                        addresses: []
                    };
                }
                acc[userIdStr].addresses.push(current);
                return acc;
            }, {});

            const results = Object.values(grouped);
            return responseReturn(res, 200, { users: results });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new addressController();
