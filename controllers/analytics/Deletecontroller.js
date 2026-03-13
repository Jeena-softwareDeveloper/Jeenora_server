const Session = require('../../models/analytics/Session');
const User = require('../../models/analytics/User');
const Event = require('../../models/analytics/Event');

// 🗑️ Clear all sessions
exports.clearAllSessions = async (req, res) => {
  try {
    console.log('🗑️ Clearing all sessions...');
    
    // Get counts before deletion for reporting
    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ is_active: true });
    const onlineUsers = await User.countDocuments({ is_online: true });

    // Delete all sessions
    const sessionResult = await Session.deleteMany({});
    
    // Mark all users as offline
    const userResult = await User.updateMany(
      { is_online: true },
      { 
        $set: { 
          is_online: false,
          last_active_at: new Date()
        } 
      }
    );

    // Reset user engagement metrics
    await User.updateMany(
      {},
      {
        $set: {
          'engagement.total_sessions': 0,
          'engagement.total_time_spent': 0,
          'engagement.avg_session_time': 0,
          'engagement.last_session_at': null
        }
      }
    );

    console.log(`✅ Cleared ${sessionResult.deletedCount} sessions`);

    res.json({
      success: true,
      message: `Successfully cleared all sessions and reset user states`,
      statistics: {
        sessionsDeleted: sessionResult.deletedCount,
        totalSessionsBefore: totalSessions,
        activeSessionsBefore: activeSessions,
        usersMarkedOffline: userResult.modifiedCount,
        onlineUsersBefore: onlineUsers
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing all sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear sessions'
    });
  }
};

// 🗑️ Clear inactive sessions only
exports.clearInactiveSessions = async (req, res) => {
  try {
    console.log('🗑️ Clearing inactive sessions...');
    
    const inactiveSessionsCount = await Session.countDocuments({ is_active: false });
    
    const result = await Session.deleteMany({ is_active: false });
    
    console.log(`✅ Cleared ${result.deletedCount} inactive sessions`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} inactive sessions`,
      deletedCount: result.deletedCount,
      totalInactiveBefore: inactiveSessionsCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing inactive sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear inactive sessions'
    });
  }
};

// 🗑️ Clear sessions older than specific date
exports.clearOldSessions = async (req, res) => {
  try {
    const { days = 7 } = req.body;
    
    if (days < 1) {
      return res.status(400).json({
        success: false,
        error: 'Days must be at least 1'
      });
    }

    console.log(`🗑️ Clearing sessions older than ${days} days...`);
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const oldSessionsCount = await Session.countDocuments({
      start_time: { $lt: cutoffDate }
    });

    const result = await Session.deleteMany({
      start_time: { $lt: cutoffDate }
    });

    console.log(`✅ Cleared ${result.deletedCount} old sessions`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions older than ${days} days`,
      deletedCount: result.deletedCount,
      totalOldBefore: oldSessionsCount,
      cutoffDate: cutoffDate,
      days: days,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing old sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear old sessions'
    });
  }
};

// 🗑️ Clear sessions for specific user
exports.clearUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log(`🗑️ Clearing sessions for user: ${userId}`);
    
    // Check if user exists
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userSessionsCount = await Session.countDocuments({ user_id: userId });
    
    const result = await Session.deleteMany({ user_id: userId });
    
    // Mark user as offline
    await User.updateOne(
      { user_id: userId },
      { 
        $set: { 
          is_online: false,
          'engagement.total_sessions': 0,
          'engagement.total_time_spent': 0,
          'engagement.avg_session_time': 0,
          'engagement.last_session_at': null
        } 
      }
    );

    console.log(`✅ Cleared ${result.deletedCount} sessions for user ${userId}`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions for user ${userId}`,
      deletedCount: result.deletedCount,
      totalSessionsBefore: userSessionsCount,
      user: {
        user_id: userId,
        is_online: false
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing user sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear user sessions'
    });
  }
};

// 📊 Get session statistics
exports.getSessionStats = async (req, res) => {
  try {
    console.log('📊 Getting session statistics...');
    
    const [
      totalSessions,
      activeSessions,
      inactiveSessions,
      totalUsers,
      onlineUsers,
      averageSessionTime,
      totalSessionTime
    ] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ is_active: true }),
      Session.countDocuments({ is_active: false }),
      User.countDocuments(),
      User.countDocuments({ is_online: true }),
      Session.aggregate([
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' }
          }
        }
      ]),
      Session.aggregate([
        {
          $group: {
            _id: null,
            totalTime: { $sum: '$duration' }
          }
        }
      ])
    ]);

    const oldestSession = await Session.findOne().sort({ start_time: 1 });
    const newestSession = await Session.findOne().sort({ start_time: -1 });

    const stats = {
      sessions: {
        total: totalSessions,
        active: activeSessions,
        inactive: inactiveSessions,
        averageDuration: averageSessionTime[0]?.avgDuration || 0,
        totalTimeSpent: totalSessionTime[0]?.totalTime || 0
      },
      users: {
        total: totalUsers,
        online: onlineUsers,
        offline: totalUsers - onlineUsers
      },
      timeline: {
        oldestSession: oldestSession?.start_time,
        newestSession: newestSession?.start_time
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting session stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get session statistics'
    });
  }
};

// 🔄 Reset all analytics data (DANGEROUS - Complete reset)
exports.resetAllAnalytics = async (req, res) => {
  try {
    console.log('⚠️ RESETTING ALL ANALYTICS DATA...');
    
    // Confirm action with token or password in production
    const { confirmation } = req.body;
    
    if (!confirmation || confirmation !== 'I understand this will delete all data') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send confirmation: "I understand this will delete all data"'
      });
    }

    // Get counts before deletion
    const [sessionCount, userCount, eventCount] = await Promise.all([
      Session.countDocuments(),
      User.countDocuments(),
      Event.countDocuments()
    ]);

    // Delete all data (in parallel for performance)
    const [sessionResult, userResult, eventResult] = await Promise.all([
      Session.deleteMany({}),
      User.deleteMany({}),
      Event.deleteMany({})
    ]);

    console.log(`✅ Reset complete: ${sessionResult.deletedCount} sessions, ${userResult.deletedCount} users, ${eventResult.deletedCount} events deleted`);

    res.json({
      success: true,
      message: 'Complete analytics reset successful',
      statistics: {
        sessionsDeleted: sessionResult.deletedCount,
        usersDeleted: userResult.deletedCount,
        eventsDeleted: eventResult.deletedCount,
        beforeReset: {
          sessions: sessionCount,
          users: userCount,
          events: eventCount
        }
      },
      timestamp: new Date().toISOString(),
      warning: 'All analytics data has been permanently deleted'
    });

  } catch (error) {
    console.error('❌ Error resetting analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to reset analytics data'
    });
  }
};