const HireUser = require('../../models/hire/hireUserModel');
const PlanSettings = require('../../models/hire/planSettingodel');
const AdminSettings = require('../../models/hire/adminSettingModel');
const bcrypt = require('bcryptjs');

// Admin Settings Controller
exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin settings',
      error: error.message
    });
  }
};

exports.updateAdminSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.getSettings();
    const updatedSettings = await AdminSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Admin settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating admin settings',
      error: error.message
    });
  }
};

// User Management
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const users = await HireUser.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await HireUser.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await HireUser.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await HireUser.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await HireUser.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Plan Settings Management
exports.getPlanSettings = async (req, res) => {
  try {
    const planSettings = await PlanSettings.getSettings();
    res.status(200).json({
      success: true,
      data: planSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching plan settings',
      error: error.message
    });
  }
};

exports.updatePlanSettings = async (req, res) => {
  try {
    const planSettings = await PlanSettings.getSettings();
    const updatedSettings = await PlanSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Plan settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating plan settings',
      error: error.message
    });
  }
};

// User Settings Management
exports.getUserSettings = async (req, res) => {
  try {
    const user = await HireUser.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user.settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user settings',
      error: error.message
    });
  }
};

// Notification Settings
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notifications } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { $set: { 'settings.notifications': notifications } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      data: user.settings.notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating notification settings',
      error: error.message
    });
  }
};

// Language Settings
exports.updateLanguageSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { language } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { $set: { 'settings.language': language } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Language settings updated successfully',
      data: user.settings.language
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating language settings',
      error: error.message
    });
  }
};

// Security Settings
exports.updateSecuritySettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { security } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { $set: { 'settings.security': security } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: user.settings.security
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating security settings',
      error: error.message
    });
  }
};

// Reset User Password (Admin Function)
exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          password: hashedPassword,
          'settings.security.lastPasswordChange': new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// Profile Visibility Settings
exports.updateProfileVisibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { privacy } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { $set: { 'settings.privacy': privacy } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile visibility settings updated successfully',
      data: user.settings.privacy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile visibility settings',
      error: error.message
    });
  }
};

// Account Deletion/Deactivation
exports.deactivateUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deactivationDate } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'settings.account.deactivationDate': deactivationDate || new Date(),
          'settings.account.isActive': false
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User account deactivated successfully',
      data: user.settings.account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user account',
      error: error.message
    });
  }
};

exports.deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deletionDate } = req.body;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'settings.account.deletionDate': deletionDate || new Date(),
          'settings.account.isActive': false
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Schedule actual deletion after specified date or immediately
    const deleteDate = deletionDate ? new Date(deletionDate) : new Date();
    if (!deletionDate || deleteDate <= new Date()) {
      await HireUser.findByIdAndDelete(userId);
      return res.status(200).json({
        success: true,
        message: 'User account deleted successfully'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User account scheduled for deletion',
      deletionDate: deleteDate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user account',
      error: error.message
    });
  }
};

// Reactivate User Account
exports.reactivateUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await HireUser.findByIdAndUpdate(
      userId,
      { 
        $set: { 
          'settings.account.deactivationDate': null,
          'settings.account.deletionDate': null,
          'settings.account.isActive': true
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User account reactivated successfully',
      data: user.settings.account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reactivating user account',
      error: error.message
    });
  }
};

// Dashboard Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await HireUser.countDocuments();
    const activeUsers = await HireUser.countDocuments({ 'settings.account.isActive': true });
    const freePlanUsers = await HireUser.countDocuments({ 'subscription.plan': 'Free' });
    const paidPlanUsers = await HireUser.countDocuments({ 
      'subscription.plan': { $in: ['Basic', 'Pro', 'Elite'] } 
    });

    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await HireUser.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        freePlanUsers,
        paidPlanUsers,
        recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};