const Session = require('../../models/analytics/Session');
const User = require('../../models/analytics/User');
const Event = require('../../models/analytics/Event');

// 🗑️ Delete single user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log(`🗑️ Deleting user: ${userId}`);
    
    // Check if user exists
    const user = await User.findOne({ user_id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get counts before deletion
    const userSessionsCount = await Session.countDocuments({ user_id: userId });
    const userEventsCount = await Event.countDocuments({ user_id: userId });

    // Delete all user sessions
    const sessionResult = await Session.deleteMany({ user_id: userId });
    
    // Delete all user events
    const eventResult = await Event.deleteMany({ user_id: userId });
    
    // Delete user
    const userResult = await User.deleteOne({ user_id: userId });

    console.log(`✅ Deleted user ${userId} and associated data`);

    res.json({
      success: true,
      message: `Successfully deleted user ${userId} and all associated data`,
      statistics: {
        userDeleted: userResult.deletedCount,
        sessionsDeleted: sessionResult.deletedCount,
        eventsDeleted: eventResult.deletedCount,
        totalSessionsBefore: userSessionsCount,
        totalEventsBefore: userEventsCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to delete user'
    });
  }
};

// 🗑️ Delete multiple users
exports.deleteMultipleUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array is required'
      });
    }

    console.log(`🗑️ Deleting ${userIds.length} users...`);
    
    // Check if users exist
    const existingUsers = await User.find({ user_id: { $in: userIds } });
    const existingUserIds = existingUsers.map(user => user.user_id);
    
    if (existingUserIds.length !== userIds.length) {
      const missingUsers = userIds.filter(id => !existingUserIds.includes(id));
      return res.status(404).json({
        success: false,
        error: `Some users not found: ${missingUsers.join(', ')}`
      });
    }

    // Get counts before deletion
    const userSessionsCount = await Session.countDocuments({ user_id: { $in: userIds } });
    const userEventsCount = await Event.countDocuments({ user_id: { $in: userIds } });

    // Delete all user sessions
    const sessionResult = await Session.deleteMany({ user_id: { $in: userIds } });
    
    // Delete all user events
    const eventResult = await Event.deleteMany({ user_id: { $in: userIds } });
    
    // Delete users
    const userResult = await User.deleteMany({ user_id: { $in: userIds } });

    console.log(`✅ Deleted ${userResult.deletedCount} users and associated data`);

    res.json({
      success: true,
      message: `Successfully deleted ${userResult.deletedCount} users and all associated data`,
      statistics: {
        usersDeleted: userResult.deletedCount,
        sessionsDeleted: sessionResult.deletedCount,
        eventsDeleted: eventResult.deletedCount,
        totalSessionsBefore: userSessionsCount,
        totalEventsBefore: userEventsCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting multiple users:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to delete users'
    });
  }
};

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
    
    // Mark user as offline and reset engagement
    await User.updateOne(
      { user_id: userId },
      { 
        $set: { 
          is_online: false,
          last_active_at: new Date(),
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

// 🗑️ Clear sessions by session IDs
exports.clearSessionsByIds = async (req, res) => {
  try {
    const { sessionIds } = req.body;
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Session IDs array is required'
      });
    }

    console.log(`🗑️ Clearing ${sessionIds.length} sessions by IDs...`);
    
    const sessionsCount = await Session.countDocuments({ _id: { $in: sessionIds } });
    
    const result = await Session.deleteMany({ _id: { $in: sessionIds } });

    console.log(`✅ Cleared ${result.deletedCount} sessions by IDs`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions`,
      deletedCount: result.deletedCount,
      totalBefore: sessionsCount,
      sessionIds: sessionIds,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing sessions by IDs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear sessions'
    });
  }
};

// 🗑️ Clear sessions by date range
exports.clearSessionsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    console.log(`🗑️ Clearing sessions between ${startDate} and ${endDate}...`);
    
    const sessionsCount = await Session.countDocuments({
      start_time: { $gte: start, $lte: end }
    });

    const result = await Session.deleteMany({
      start_time: { $gte: start, $lte: end }
    });

    console.log(`✅ Cleared ${result.deletedCount} sessions in date range`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions between ${startDate} and ${endDate}`,
      deletedCount: result.deletedCount,
      totalBefore: sessionsCount,
      dateRange: {
        start: startDate,
        end: endDate
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing sessions by date range:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear sessions by date range'
    });
  }
};

// 🗑️ Clear sessions by device type
exports.clearSessionsByDevice = async (req, res) => {
  try {
    const { deviceType } = req.body;
    
    if (!deviceType) {
      return res.status(400).json({
        success: false,
        error: 'Device type is required'
      });
    }

    console.log(`🗑️ Clearing sessions for device type: ${deviceType}...`);
    
    const sessionsCount = await Session.countDocuments({ device_type: deviceType });
    
    const result = await Session.deleteMany({ device_type: deviceType });

    console.log(`✅ Cleared ${result.deletedCount} sessions for device type ${deviceType}`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions for device type ${deviceType}`,
      deletedCount: result.deletedCount,
      totalBefore: sessionsCount,
      deviceType: deviceType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing sessions by device type:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear sessions by device type'
    });
  }
};

// 🗑️ Clear sessions by country
exports.clearSessionsByCountry = async (req, res) => {
  try {
    const { country } = req.body;
    
    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'Country is required'
      });
    }

    console.log(`🗑️ Clearing sessions for country: ${country}...`);
    
    const sessionsCount = await Session.countDocuments({ country: country });
    
    const result = await Session.deleteMany({ country: country });

    console.log(`✅ Cleared ${result.deletedCount} sessions for country ${country}`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions for country ${country}`,
      deletedCount: result.deletedCount,
      totalBefore: sessionsCount,
      country: country,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing sessions by country:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear sessions by country'
    });
  }
};

// 🗑️ Clear sessions with duration less than specified
exports.clearShortSessions = async (req, res) => {
  try {
    const { maxDuration = 60 } = req.body; // in seconds
    
    if (maxDuration < 1) {
      return res.status(400).json({
        success: false,
        error: 'Max duration must be at least 1 second'
      });
    }

    console.log(`🗑️ Clearing sessions shorter than ${maxDuration} seconds...`);
    
    const shortSessionsCount = await Session.countDocuments({
      duration: { $lt: maxDuration }
    });

    const result = await Session.deleteMany({
      duration: { $lt: maxDuration }
    });

    console.log(`✅ Cleared ${result.deletedCount} short sessions`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} sessions shorter than ${maxDuration} seconds`,
      deletedCount: result.deletedCount,
      totalBefore: shortSessionsCount,
      maxDuration: maxDuration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing short sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear short sessions'
    });
  }
};

// 🗑️ Clear abandoned sessions (no events)
exports.clearAbandonedSessions = async (req, res) => {
  try {
    console.log('🗑️ Clearing abandoned sessions (no events)...');
    
    // Find sessions that have no associated events
    const abandonedSessions = await Session.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'session_id',
          as: 'events'
        }
      },
      {
        $match: {
          events: { $size: 0 }
        }
      },
      {
        $project: {
          _id: 1
        }
      }
    ]);

    const abandonedSessionIds = abandonedSessions.map(session => session._id);
    const abandonedCount = abandonedSessionIds.length;

    const result = await Session.deleteMany({
      _id: { $in: abandonedSessionIds }
    });

    console.log(`✅ Cleared ${result.deletedCount} abandoned sessions`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} abandoned sessions (no events)`,
      deletedCount: result.deletedCount,
      totalBefore: abandonedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing abandoned sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear abandoned sessions'
    });
  }
};

// 🗑️ Clear duplicate sessions (same user, same start time within threshold)
exports.clearDuplicateSessions = async (req, res) => {
  try {
    const { timeThreshold = 300 } = req.body; // 5 minutes in seconds
    
    console.log(`🗑️ Clearing duplicate sessions (within ${timeThreshold} seconds)...`);
    
    // Find duplicate sessions
    const duplicateSessions = await Session.aggregate([
      {
        $group: {
          _id: {
            user_id: '$user_id',
            start_time_bucket: {
              $subtract: [
                { $toLong: '$start_time' },
                { $mod: [{ $toLong: '$start_time' }, timeThreshold * 1000] }
              ]
            }
          },
          sessions: { $push: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $project: {
          sessions: {
            $slice: ['$sessions', 1, { $size: '$sessions' }] // Keep first, delete rest
          }
        }
      },
      {
        $unwind: '$sessions'
      },
      {
        $project: {
          _id: '$sessions._id'
        }
      }
    ]);

    const duplicateSessionIds = duplicateSessions.map(session => session._id);
    const duplicateCount = duplicateSessionIds.length;

    const result = await Session.deleteMany({
      _id: { $in: duplicateSessionIds }
    });

    console.log(`✅ Cleared ${result.deletedCount} duplicate sessions`);

    res.json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} duplicate sessions`,
      deletedCount: result.deletedCount,
      totalBefore: duplicateCount,
      timeThreshold: timeThreshold,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error clearing duplicate sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear duplicate sessions'
    });
  }
};

// 🗑️ Bulk delete sessions with custom filters
exports.bulkDeleteSessions = async (req, res) => {
  try {
    const {
      deviceType,
      country,
      minDuration,
      maxDuration,
      startDate,
      endDate,
      isActive
    } = req.body;

    // Build filter object
    const filter = {};
    
    if (deviceType) {
      filter.device_type = deviceType;
    }
    
    if (country) {
      filter.country = country;
    }
    
    if (minDuration !== undefined || maxDuration !== undefined) {
      filter.duration = {};
      if (minDuration !== undefined) filter.duration.$gte = minDuration;
      if (maxDuration !== undefined) filter.duration.$lte = maxDuration;
    }
    
    if (startDate || endDate) {
      filter.start_time = {};
      if (startDate) filter.start_time.$gte = new Date(startDate);
      if (endDate) filter.start_time.$lte = new Date(endDate);
    }
    
    if (isActive !== undefined) {
      filter.is_active = isActive;
    }

    console.log('🗑️ Bulk deleting sessions with filters:', filter);
    
    const sessionsCount = await Session.countDocuments(filter);
    
    const result = await Session.deleteMany(filter);

    console.log(`✅ Bulk deleted ${result.deletedCount} sessions`);

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} sessions with specified filters`,
      deletedCount: result.deletedCount,
      totalBefore: sessionsCount,
      filters: filter,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in bulk session deletion:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to bulk delete sessions'
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
      totalSessionTime,
      sessionsByDevice,
      sessionsByCountry
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
      ]),
      Session.aggregate([
        {
          $group: {
            _id: '$device_type',
            count: { $sum: 1 }
          }
        }
      ]),
      Session.aggregate([
        {
          $group: {
            _id: '$country',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const oldestSession = await Session.findOne().sort({ start_time: 1 });
    const newestSession = await Session.findOne().sort({ start_time: -1 });

    // Get session duration distribution
    const durationDistribution = await Session.aggregate([
      {
        $bucket: {
          groupBy: '$duration',
          boundaries: [0, 30, 60, 300, 600, 1800, 3600, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

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
      },
      distribution: {
        byDevice: sessionsByDevice,
        byCountry: sessionsByCountry,
        byDuration: durationDistribution
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