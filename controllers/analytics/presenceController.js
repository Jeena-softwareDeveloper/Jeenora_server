const Presence = require('../../models/analytics/Presence');

exports.updatePresence = async (req, res) => {
  try {
    const { user_id, session_id, page_url, device_type, location } = req.body;
    
    const presenceData = {
      user_id,
      session_id,
      page_url,
      device_type,
      location,
      last_ping: new Date(),
      is_active: true,
      idle_time: 0
    };

    const presence = await Presence.findOneAndUpdate(
      { user_id },
      presenceData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: presence
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getActiveUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const thresholdTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const activeUsers = await Presence.find({
      last_ping: { $gte: thresholdTime },
      is_active: true
    })
    .sort({ last_ping: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Presence.countDocuments({
      last_ping: { $gte: thresholdTime },
      is_active: true
    });

    res.json({
      success: true,
      data: activeUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getUserPresence = async (req, res) => {
  try {
    const presence = await Presence.findOne({ user_id: req.params.userId });
    
    if (!presence) {
      return res.status(404).json({
        success: false,
        error: 'User presence not found'
      });
    }

    res.json({
      success: true,
      data: presence
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.updateIdleTime = async (req, res) => {
  try {
    const { user_id, idle_time } = req.body;
    
    const presence = await Presence.findOneAndUpdate(
      { user_id },
      {
        idle_time,
        is_active: idle_time < 300000 // 5 minutes in milliseconds
      },
      { new: true }
    );

    if (!presence) {
      return res.status(404).json({
        success: false,
        error: 'User presence not found'
      });
    }

    res.json({
      success: true,
      data: presence
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getRealTimeAnalytics = async (req, res) => {
  try {
    const thresholdTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const [activeUsers, usersByDevice, usersByPage, totalActive] = await Promise.all([
      Presence.find({
        last_ping: { $gte: thresholdTime },
        is_active: true
      }),
      Presence.aggregate([
        {
          $match: {
            last_ping: { $gte: thresholdTime },
            is_active: true
          }
        },
        {
          $group: {
            _id: '$device_type',
            count: { $sum: 1 }
          }
        }
      ]),
      Presence.aggregate([
        {
          $match: {
            last_ping: { $gte: thresholdTime },
            is_active: true
          }
        },
        {
          $group: {
            _id: '$page_url',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Presence.countDocuments({
        last_ping: { $gte: thresholdTime },
        is_active: true
      })
    ]);

    const analytics = {
      total_active_users: totalActive,
      users_by_device: usersByDevice.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      popular_pages: usersByPage,
      active_users: activeUsers.map(user => ({
        user_id: user.user_id,
        page_url: user.page_url,
        device_type: user.device_type,
        last_ping: user.last_ping,
        location: user.location
      }))
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.cleanupInactiveUsers = async (req, res) => {
  try {
    const thresholdTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    
    const result = await Presence.updateMany(
      {
        last_ping: { $lt: thresholdTime },
        is_active: true
      },
      {
        $set: { is_active: false }
      }
    );

    res.json({
      success: true,
      data: {
        modified_count: result.modifiedCount,
        message: 'Inactive users cleaned up successfully'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};