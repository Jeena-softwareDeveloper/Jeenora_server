const customerModel = require("../../models/wear/Customer");
const WearBuyer = require("../../models/wear/wearBuyerModel");
const chatSupportTicket = require("../../models/ChatSupportTicket");
const { responseReturn } = require("../../utils/response");

class profileController {
    get_profile = async (req, res) => {
        const { id } = req;
        try {
            // DB level selection
            let user = await customerModel.findById(id).select('name email phone image referralCode');
            let userModel = customerModel;
    
            if (!user) {
                user = await WearBuyer.findById(id).select('name email phone image referralCode');
                userModel = WearBuyer;
            }
    
            if (!user) return responseReturn(res, 404, { error: 'User not found' });
    
            // Generate Referral Code ONLY if missing
            if (!user.referralCode) {
                const namePart = (user.name || 'JEEN').substring(0, 4).toUpperCase();
                const randomPart = Math.floor(1000 + Math.random() * 9000);
                user.referralCode = `${namePart}${randomPart}`;
                await user.save();
            }
    
            // Check if user is a Supplier (Strict fetch)
            const Supplier = require('../../models/wear/Supplier');
            const supplierInfo = await Supplier.findOne({ user: user._id }).select('status businessDetails.shopName').lean();
    
            // Explicitly build response object (Whitelist only)
            const userInfo = {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                image: user.image,
                referralCode: user.referralCode,
                membershipLevel: 'Silver Member',
                supplierInfo: supplierInfo ? {
                    status: supplierInfo.status,
                    shopName: supplierInfo.businessDetails?.shopName
                } : null
            };
    
            responseReturn(res, 200, { userInfo });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    update_profile = async (req, res) => {
        const { id } = req;
        const { name, email, phone } = req.body;
        try {
            const user = await customerModel.findByIdAndUpdate(id, {
                name, email, phone
            }, { new: true });
            responseReturn(res, 200, { userInfo: user, message: 'Profile updated successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_wallet = async (req, res) => {
        const { id } = req;
        try {
            const user = await customerModel.findById(id).select('wallet');
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                balance: user.wallet?.balance || 0,
                cashback: user.wallet?.cashback || 0,
                referralBonus: user.wallet?.referralBonus || 0,
                history: (user.wallet?.transactions || []).sort((a, b) => b.date - a.date)
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get bank details from Supplier or User model
    get_bank_details = async (req, res) => {
        const { id } = req;
        try {
            // Check Supplier first
            const Supplier = require('../../models/wear/Supplier');
            const supplier = await Supplier.findOne({ user: id }).select('bankDetails');

            if (supplier && supplier.bankDetails) {
                return responseReturn(res, 200, {
                    bankDetails: {
                        accountHolderName: supplier.bankDetails.accountHolderName,
                        accountNumber: supplier.bankDetails.accountNumber,
                        ifsc: supplier.bankDetails.ifscCode,
                        bankName: supplier.bankDetails.bankName,
                        branchName: supplier.bankDetails.branchName,
                        isVerified: true
                    }
                });
            }

            // Check User/Buyer
            let user = await customerModel.findById(id).select('+bankDetails');
            if (!user) user = await WearBuyer.findById(id).select('+bankDetails');

            if (user && user.bankDetails && user.bankDetails.accountNumber) {
                return responseReturn(res, 200, {
                    bankDetails: {
                        accountHolderName: user.bankDetails.accountHolderName,
                        accountNumber: user.bankDetails.accountNumber,
                        ifsc: user.bankDetails.ifscCode,
                        bankName: user.bankDetails.bankName,
                        branchName: user.bankDetails.branchName,
                        isVerified: user.bankDetails.isVerified
                    }
                });
            }

            responseReturn(res, 200, { bankDetails: null, message: 'No bank details found.' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update bank details (for refunds/payouts)
    update_bank_details = async (req, res) => {
        const { id } = req;
        const { bankDetails } = req.body;
        try {
            let user = await customerModel.findByIdAndUpdate(
                id,
                { bankDetails: { ...bankDetails, isVerified: true } },
                { new: true }
            );

            if (!user) {
                user = await WearBuyer.findByIdAndUpdate(
                    id,
                    { bankDetails: { ...bankDetails, isVerified: true } },
                    { new: true }
                );
            }

            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                message: 'Bank details updated successfully',
                bankDetails: user.bankDetails
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    submit_support_ticket = async (req, res) => {
        const { id } = req;
        const { subject, message, type } = req.body;
        try {
            const ticket = await chatSupportTicket.create({
                userId: id,
                subject,
                message,
                type: type || 'support',
                status: 'pending'
            });
            responseReturn(res, 201, { ticket, message: 'Support ticket submitted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Notification Settings
    get_notification_settings = async (req, res) => {
        const { id } = req;
        try {
            let user = await customerModel.findById(id).select('notificationSettings');
            if (!user) user = await WearBuyer.findById(id).select('notificationSettings');
            
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                settings: user.notificationSettings || {
                    orderUpdates: true,
                    promotions: true,
                    newArrivals: true,
                    priceDrops: true,
                    emailNotifications: true,
                    whatsappNotifications: true,
                    pushNotifications: true
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update Notification Settings
    update_notification_settings = async (req, res) => {
        const { id } = req;
        const settings = req.body;
        try {
            let user = await customerModel.findByIdAndUpdate(
                id,
                { notificationSettings: settings },
                { new: true }
            ).select('notificationSettings');

            if (!user) {
                user = await WearBuyer.findByIdAndUpdate(
                    id,
                    { notificationSettings: settings },
                    { new: true }
                ).select('notificationSettings');
            }

            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                settings: user.notificationSettings,
                message: 'Notification settings updated successfully'
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Get Privacy Settings
    get_privacy_settings = async (req, res) => {
        const { id } = req;
        try {
            const user = await customerModel.findById(id).select('privacySettings');
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            responseReturn(res, 200, {
                settings: user.privacySettings || {
                    profileVisibility: 'public',
                    showOnlineStatus: true,
                    dataSharing: false
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Update Privacy Settings
    update_privacy_settings = async (req, res) => {
        const { id } = req;
        const settings = req.body;
        try {
            const user = await customerModel.findByIdAndUpdate(
                id,
                { privacySettings: settings },
                { new: true }
            ).select('privacySettings');

            responseReturn(res, 200, {
                settings: user.privacySettings,
                message: 'Privacy settings updated successfully'
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new profileController();
