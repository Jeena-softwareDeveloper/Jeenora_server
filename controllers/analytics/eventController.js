const Event = require('../../models/analytics/Event');
const User = require('../../models/analytics/User');
const Session = require('../../models/analytics/Session');
const Page = require('../../models/analytics/Pages');

exports.trackEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      event_id: req.body.event_id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: req.body.timestamp || new Date()
    };

    const event = new Event(eventData);
    await event.save();

    // Update user engagement metrics
    await User.findOneAndUpdate(
      { user_id: eventData.user_id },
      {
        last_seen_at: new Date(),
        $inc: {
          'engagement.total_events': 1,
          'engagement.total_time_spent': eventData.duration || 0
        }
      }
    );

    // Update page metrics if it's a page view
    if (eventData.event_type === 'page_view' && eventData.metadata?.page_url) {
      await updatePageMetrics(eventData.metadata.page_url, eventData);
    }

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

async function updatePageMetrics(pageUrl, eventData) {
  try {
    const page = await Page.findOne({ page_url: pageUrl });
    
    if (page) {
      page.total_views += 1;
      page.total_time_spent += eventData.duration || 0;
      page.avg_duration = page.total_time_spent / page.total_views;
      page.last_viewed_at = new Date();
      
      // Update unique users count
      const uniqueSessionCount = await Event.distinct('user_id', {
        'metadata.page_url': pageUrl
      });
      page.unique_users = uniqueSessionCount.length;
      
      await page.save();
    } else {
      // Create new page record
      const newPage = new Page({
        page_url: pageUrl,
        title: eventData.metadata?.page_title || 'Unknown',
        total_views: 1,
        unique_users: 1,
        avg_duration: eventData.duration || 0,
        total_time_spent: eventData.duration || 0,
        last_viewed_at: new Date()
      });
      await newPage.save();
    }
  } catch (error) {
    console.error('Error updating page metrics:', error);
  }
}

exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findOne({ event_id: req.params.eventId });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getEventsByType = async (req, res) => {
  try {
    const { event_type, start_date, end_date, page = 1, limit = 50 } = req.query;
    
    const filter = { event_type };
    
    if (start_date && end_date) {
      filter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const events = await Event.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      data: events,
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

exports.getEventAnalytics = async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'hour' } = req.query;
    
    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const eventStats = await Event.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$event_type',
          count: { $sum: 1 },
          avg_duration: { $avg: '$duration' },
          total_duration: { $sum: '$duration' },
          unique_users: { $addToSet: '$user_id' }
        }
      },
      {
        $project: {
          event_type: '$_id',
          count: 1,
          avg_duration: 1,
          total_duration: 1,
          unique_users_count: { $size: '$unique_users' }
        }
      }
    ]);

    const timelineStats = await Event.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: group_by === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          count: { $sum: 1 },
          unique_users: { $addToSet: '$user_id' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const popularPages = await Event.aggregate([
      { 
        $match: { 
          ...dateFilter,
          event_type: 'page_view'
        } 
      },
      {
        $group: {
          _id: '$metadata.page_url',
          views: { $sum: 1 },
          unique_users: { $addToSet: '$user_id' },
          avg_duration: { $avg: '$duration' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        event_summary: eventStats,
        timeline: timelineStats,
        popular_pages: popularPages
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.bulkTrackEvents = async (req, res) => {
  try {
    const events = req.body.events;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Events array is required'
      });
    }

    const eventsWithIds = events.map(event => ({
      ...event,
      event_id: event.event_id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp || new Date()
    }));

    const result = await Event.insertMany(eventsWithIds, { ordered: false });

    // Update user metrics for all unique users
    const uniqueUserIds = [...new Set(events.map(event => event.user_id))];
    
    for (const userId of uniqueUserIds) {
      const userEvents = events.filter(event => event.user_id === userId);
      const totalDuration = userEvents.reduce((sum, event) => sum + (event.duration || 0), 0);
      
      await User.findOneAndUpdate(
        { user_id: userId },
        {
          last_seen_at: new Date(),
          $inc: {
            'engagement.total_events': userEvents.length,
            'engagement.total_time_spent': totalDuration
          }
        }
      );
    }

    res.status(201).json({
      success: true,
      data: {
        inserted_count: result.length,
        events: result
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};