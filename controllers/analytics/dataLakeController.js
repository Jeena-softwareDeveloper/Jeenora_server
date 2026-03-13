const DataLake = require('../../models/analytics/DataLake');

exports.storeRawEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      event_id: req.body.event_id || `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: req.body.timestamp || new Date()
    };

    const dataLakeEvent = new DataLake(eventData);
    await dataLakeEvent.save();

    res.status(201).json({
      success: true,
      data: dataLakeEvent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getRawEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, processed, start_date, end_date } = req.query;
    
    const filter = {};
    
    if (processed !== undefined) {
      filter.processed = processed === 'true';
    }
    
    if (start_date && end_date) {
      filter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const events = await DataLake.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DataLake.countDocuments(filter);

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

exports.bulkStoreEvents = async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Events array is required'
      });
    }

    const eventsWithIds = events.map(event => ({
      ...event,
      event_id: event.event_id || `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp || new Date()
    }));

    const result = await DataLake.insertMany(eventsWithIds, { ordered: false });

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

exports.markAsProcessed = async (req, res) => {
  try {
    const event = await DataLake.findOneAndUpdate(
      { event_id: req.params.eventId },
      { processed: true },
      { new: true }
    );

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
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.bulkMarkAsProcessed = async (req, res) => {
  try {
    const { event_ids } = req.body;
    
    if (!Array.isArray(event_ids) || event_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Event IDs array is required'
      });
    }

    const result = await DataLake.updateMany(
      { event_id: { $in: event_ids } },
      { processed: true }
    );

    res.json({
      success: true,
      data: {
        modified_count: result.modifiedCount,
        message: 'Events marked as processed successfully'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getDataLakeAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const [storageStats, processingStats, timelineStats] = await Promise.all([
      DataLake.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total_events: { $sum: 1 },
            processed_events: {
              $sum: { $cond: ['$processed', 1, 0] }
            },
            unprocessed_events: {
              $sum: { $cond: ['$processed', 0, 1] }
            }
          }
        }
      ]),
      DataLake.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$processed',
            count: { $sum: 1 },
            avg_size: { $avg: { $bsonSize: '$raw_event_data' } }
          }
        }
      ]),
      DataLake.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            },
            total: { $sum: 1 },
            processed: {
              $sum: { $cond: ['$processed', 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const analytics = {
      storage: storageStats[0] || {
        total_events: 0,
        processed_events: 0,
        unprocessed_events: 0
      },
      processing: processingStats.reduce((acc, curr) => {
        acc[curr._id ? 'processed' : 'unprocessed'] = {
          count: curr.count,
          avg_size: curr.avg_size
        };
        return acc;
      }, {}),
      timeline: timelineStats,
      processing_rate: storageStats[0] ? 
        (storageStats[0].processed_events / storageStats[0].total_events) * 100 : 0
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