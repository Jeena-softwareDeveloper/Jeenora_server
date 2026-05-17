const customerModel = require("../../models/customer/Customer");
const { responseReturn } = require("../../utils/response");

class walletController {

    // User: View Wallet
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

    // Admin: Add/Deduct Credits
    update_wallet_admin = async (req, res) => {
        const { userId, amount, type, reason, source } = req.body;
        // type: 'credit' or 'debit'

        try {
            const user = await customerModel.findById(userId);
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            if (!user.wallet) {
                user.wallet = { balance: 0, cashback: 0, referralBonus: 0, transactions: [] };
            }

            const numAmount = Number(amount);
            if (type === 'credit') {
                user.wallet.balance += numAmount;
                if (source === 'cashback') user.wallet.cashback += numAmount;
                if (source === 'referral') user.wallet.referralBonus += numAmount;
            } else {
                user.wallet.balance -= numAmount;
                if (source === 'cashback') user.wallet.cashback = Math.max(0, user.wallet.cashback - numAmount);
                if (source === 'referral') user.wallet.referralBonus = Math.max(0, user.wallet.referralBonus - numAmount);
            }

            user.wallet.transactions.push({
                type,
                amount: numAmount,
                reason,
                source: source || 'admin',
                date: new Date()
            });

            await user.save();
            responseReturn(res, 200, { message: 'Wallet updated successfully', wallet: user.wallet });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new walletController();
