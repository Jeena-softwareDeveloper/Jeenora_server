const axios = require('axios');
const crypto = require('crypto');

class PhonePeService {
    constructor() {
        this.merchantId = process.env.PHONEPE_MERCHANT_ID;
        this.saltKey = process.env.PHONEPE_SALT_KEY;
        this.saltIndex = process.env.PHONEPE_SALT_INDEX;
        this.apiUrl = process.env.PHONEPE_API_URL;
        this.statusUrl = process.env.PHONEPE_STATUS_URL;
    }

    createOrder = async (amount, transactionId, userId, mobileNumber) => {
        try {
            const payload = {
                merchantId: this.merchantId,
                merchantTransactionId: transactionId,
                merchantUserId: userId,
                amount: Math.round(amount * 100), // Convert to paise
                redirectUrl: `${process.env.PHONEPE_REDIRECT_URL}?id=${transactionId}`,
                redirectMode: "REDIRECT",
                callbackUrl: process.env.PHONEPE_CALLBACK_URL,
                mobileNumber: mobileNumber,
                paymentInstrument: {
                    type: "PAY_PAGE"
                }
            };

            const bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
            const base64EncodedPayload = bufferObj.toString("base64");
            const stringToHash = base64EncodedPayload + "/pg/v1/pay" + this.saltKey;
            const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
            const checksum = sha256 + "###" + this.saltIndex;

            const options = {
                method: 'post',
                url: this.apiUrl,
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'accept': 'application/json'
                },
                data: {
                    request: base64EncodedPayload
                }
            };

            const response = await axios.request(options);
            return response.data;
        } catch (error) {
            console.error('PhonePe order creation failed:', error.response?.data || error.message);
            throw error;
        }
    }

    verifyPayment = async (merchantTransactionId) => {
        try {
            const endpoint = `/pg/v1/status/${this.merchantId}/${merchantTransactionId}`;
            const stringToHash = endpoint + this.saltKey;
            const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
            const checksum = sha256 + "###" + this.saltIndex;

            const options = {
                method: 'get',
                url: `${this.statusUrl}/${this.merchantId}/${merchantTransactionId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'X-MERCHANT-ID': this.merchantId,
                    'accept': 'application/json'
                }
            };

            const response = await axios.request(options);
            return response.data;
        } catch (error) {
            console.error('PhonePe verification failed:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new PhonePeService();
