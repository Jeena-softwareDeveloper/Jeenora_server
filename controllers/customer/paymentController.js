const Partner = require('../../models/partner/Partner')
const partnerWallet = require('../../models/partner/partnerWallet')
const WithdrawRequest = require('../../models/partner/WithdrawRequest')
const { responseReturn } = require('../../utils/response')
const { mongo: { ObjectId } } = require('mongoose')

class paymentController {
    sumAmount = (data) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum = sum + data[i].amount;
        }
        return sum
    }

    get_partner_payment_details = async (req, res) => {
        const { partnerId } = req.params

        try {
            const payments = await partnerWallet.find({ partnerId })

            const pendingWithdraws = await WithdrawRequest.find({
                $and: [
                    {
                        partnerId: {
                            $eq: partnerId
                        }
                    },
                    {
                        status: {
                            $eq: 'pending'
                        }
                    }
                ]
            })
            const successWithdraws = await WithdrawRequest.find({
                $and: [
                    {
                        partnerId: {
                            $eq: partnerId
                        }
                    },
                    {
                        status: {
                            $eq: 'success'
                        }
                    }
                ]
            })
            const pendingAmount = this.sumAmount(pendingWithdraws)
            const withdrawAmount = this.sumAmount(successWithdraws)
            const totalAmount = this.sumAmount(payments)

            let availableAmount = 0;
            if (totalAmount > 0) {
                availableAmount = (totalAmount - (pendingAmount + withdrawAmount))
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
                withdrawAmount,
                availableAmount,
                pendingWithdraws: mapRequest(pendingWithdraws),
                successWithdraws: mapRequest(successWithdraws)
            })

        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 

    withdrawal_request = async (req, res) => {
        const { amount, partnerId } = req.body
        try {
            const withdrawal = await WithdrawRequest.create({
                partnerId,
                amount: parseInt(amount)
            })
            responseReturn(res, 200, { withdrawal, message: 'Withdrawal Request Sent' })
        } catch (error) {
            responseReturn(res, 500, { message: 'Internal Server Error' })
        }
    }
    // End Method 
    get_payment_request = async (req, res) => {
        try {
            const withdrawalRequest = await WithdrawRequest.find({ status: 'pending' })
            responseReturn(res, 200, { withdrawalRequest })
        } catch (error) {
            responseReturn(res, 500, { message: 'Internal Server Error' })
        }
    }
    // End Method 

    payment_request_confirm = async (req, res) => {
        const { paymentId } = req.body;
        try {
            // Update withdrawal request status to success
            await WithdrawRequest.findByIdAndUpdate(paymentId, { status: 'success' });

            const payment = await WithdrawRequest.findById(paymentId);
            responseReturn(res, 200, { payment, message: 'Request Confirm Success' });
        } catch (error) {
            console.log(error);
            responseReturn(res, 500, { message: 'Internal Server Error' });
        }
    }
    // End Method 
}

module.exports = new paymentController()
