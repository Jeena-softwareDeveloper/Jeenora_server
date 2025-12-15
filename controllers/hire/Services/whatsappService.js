const { sendWhatsApp } = require('../../../controllers/Awareness/WhatsappController'); // Import your existing service

exports.sendWhatsApp = async (userId, message) => {
  try {
    const HireUser = require('../models/HireUser');
    const user = await HireUser.findById(userId).select('phone name');
    
    if (!user || !user.phone) {
      console.log('User not found or no phone number');
      return false;
    }

    // Use your existing WhatsApp service
    const result = await sendWhatsApp(user.phone, message);
    
    if (result.success) {
      console.log(`✅ WhatsApp sent to ${user.phone}: ${message}`);
      return true;
    } else {
      console.error(`❌ WhatsApp failed for ${user.phone}:`, result.error);
      return false;
    }
  } catch (error) {
    console.error('Error in WhatsApp service:', error);
    return false;
  }
};

// For bulk notifications
exports.sendBulkWhatsApp = async (userIds, message) => {
  try {
    const HireUser = require('../models/HireUser');
    const users = await HireUser.find({ _id: { $in: userIds } }).select('phone name');
    
    const results = [];
    for (const user of users) {
      if (user.phone) {
        const result = await sendWhatsApp(user.phone, message);
        results.push({
          userId: user._id,
          phone: user.phone,
          success: result.success,
          error: result.error
        });
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in bulk WhatsApp:', error);
    return [];
  }
};