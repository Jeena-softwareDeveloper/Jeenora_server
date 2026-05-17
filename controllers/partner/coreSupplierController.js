const partnerModel = require("../../models/partner/Partner");
const { responseReturn } = require("../../utils/response");

class supplierController {
    apply_supplier = async (req, res) => {
        const { id } = req; // The user ID applying to become a supplier
        const { shopName, businessType, gstNumber, address } = req.body;
        try {
            // In this system, a 'customer' might become a 'partner'
            // or we just update the partner record if it already exists or link it.

            const existing = await partnerModel.findOne({ email: req.user.email });
            if (existing) {
                return responseReturn(res, 400, { error: 'You have already applied or are a supplier' });
            }

            const supplier = await partnerModel.create({
                name: req.user.name,
                email: req.user.email,
                password: 'linked_account', // or keep original
                method: 'conversion',
                status: 'pending',
                shopInfo: {
                    shopName,
                    businessType,
                    gstNumber,
                    address
                }
            });

            responseReturn(res, 201, {
                supplier,
                message: 'Supplier application submitted successfully',
                enrolmentId: supplier._id
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_status = async (req, res) => {
        const { email } = req.user;
        try {
            const supplier = await partnerModel.findOne({ email });
            if (!supplier) return responseReturn(res, 404, { error: 'No application found' });

            responseReturn(res, 200, {
                status: supplier.status,
                enrolmentId: supplier._id
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_enrolment = async (req, res) => {
        const { email } = req.user;
        try {
            const supplier = await partnerModel.findOne({ email });
            if (!supplier) return responseReturn(res, 404, { error: 'No enrolment found' });

            responseReturn(res, 200, { enrolmentId: supplier._id });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new supplierController();
