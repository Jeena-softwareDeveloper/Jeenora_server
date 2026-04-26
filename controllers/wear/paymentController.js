const sellerModel = require('../../models/wear/sellerModel')
const sellerWallet = require('../../models/wear/sellerWallet')
const withdrowRequest = require('../../models/withdrowRequest')
const { responseReturn } = require('../../utiles/response')
const { mongo: { ObjectId } } = require('mongoose')

class paymentController {
    sumAmount = (data) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum = sum + data[i].amount;
        }
        return sum
    }

    get_seller_payment_details = async (req, res) => {
        const { sellerId } = req.params

        try {
            const payments = await sellerWallet.find({ sellerId })

            const pendingWithdrows = await withdrowRequest.find({
                $and: [
                    {
                        sellerId: {
                            $eq: sellerId
                        }
                    },
                    {
                        status: {
                            $eq: 'pending'
                        }
                    }
                ]
            })
            const successWithdrows = await withdrowRequest.find({
                $and: [
                    {
                        sellerId: {
                            $eq: sellerId
                        }
                    },
                    {
                        status: {
                            $eq: 'success'
                        }
                    }
                ]
            })
            const pendingAmount = this.sumAmount(pendingWithdrows)
            const withdrowAmount = this.sumAmount(successWithdrows)
            const totalAmount = this.sumAmount(payments)

            let availableAmount = 0;
            if (totalAmount > 0) {
                availableAmount = (totalAmount - (pendingAmount + withdrowAmount))
            }

            const mapRequest = (reqs) => reqs.map(r => ({
                amount: r.amount,
                status: r.status,
                createdAt: r.createdAt,
                _id: r._id
            }));

            responseReturn(res, 200, {
                totalAmount,
                pendingAmount,
                withdrowAmount,
                availableAmount,
                pendingWithdrows: mapRequest(pendingWithdrows),
                successWithdrows: mapRequest(successWithdrows)
            })

        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 

    withdrowal_request = async (req, res) => {
        const { amount, sellerId } = req.body
        try {
            const withdrowal = await withdrowRequest.create({
                sellerId,
                amount: parseInt(amount)
            })
            responseReturn(res, 200, { withdrowal, message: 'Withdrowal Request Send' })
        } catch (error) {
            responseReturn(res, 500, { message: 'Internal Server Error' })
        }
    }
    // End Method 
    get_payment_request = async (req, res) => {
        try {
            const withdrowalRequest = await withdrowRequest.find({ status: 'pending' })
            responseReturn(res, 200, { withdrowalRequest })
        } catch (error) {
            responseReturn(res, 500, { message: 'Internal Server Error' })
        }
    }
    // End Method 

    payment_request_confirm = async (req, res) => {
        const { paymentId } = req.body;
        try {
            // Update withdrawal request status to success
            await withdrowRequest.findByIdAndUpdate(paymentId, { status: 'success' });

            const payment = await withdrowRequest.findById(paymentId);
            responseReturn(res, 200, { payment, message: 'Request Confirm Success' });
        } catch (error) {
            console.log(error);
            responseReturn(res, 500, { message: 'Internal Server Error' });
        }
    }
    // End Method 
}

module.exports = new paymentController()
