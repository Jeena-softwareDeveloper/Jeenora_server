// Simulate SMS service for OTP
const sendSMS = async (phone, otp) => {
    console.log(`[SMS Service] Sending OTP ${otp} to ${phone}`);
    // In a real app, you would integrate Twilio, MSG91, or any other SMS gateway here.
    return { success: true };
};

module.exports = {
    sendSMS
};
