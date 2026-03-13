const StreamEvent = require('../../models/analytics/StreemEvent');

exports.processStreamEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      event_id: req.body.event_id || `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: req.body.timestamp || new Date(),
      processing_status: 'pending'
    };

    const streamEvent = new StreamEvent(eventData);
    await streamEvent.save();

    // Simulate async processing
    processEventAsync(streamEvent);

    res.status(202).json({
      success: true,
      data: {
        event_id: streamEvent.event_id,
        status: 'accepted',
        processing_status: 'pending'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

async function processEventAsync(streamEvent) {
  try {
    // Update status to processing
    await StreamEvent.findOneAndUpdate(
      { event_id: streamEvent.event_id },
      { processing_status: 'processing' }
    );

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mark as completed
    await StreamEvent.findOneAndUpdate(
      { event_id: streamEvent.event_id },
      {
        processing_status: 'completed',
        processed_at: new Date()
      }
    );

    console.log(`Processed stream event: ${streamEvent.event_id}`);
  } catch (error) {
    await StreamEvent.findOneAndUpdate(
      { event_id: streamEvent.event_id },
      {
        processing_status: 'failed',
        error_message: error.message
      }
    );
    
    console.error(`Failed to process stream event: ${streamEvent.event_id}`, error);
  }
}

exports.getStreamEvent = async (req, res) => {
  try {
    const event = await StreamEvent.findOne({ event_id: req.params.eventId });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Stream event not found'
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

exports.getEventsByStatus = async (req, res) => {
  try {
    const { status, stream_source, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    
    if (status) {
      filter.processing_status = status;
    }
    
    if (stream_source) {
      filter.stream_source = stream_source;
    }

    const events = await StreamEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StreamEvent.countDocuments(filter);

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

exports.retryFailedEvents = async (req, res) => {
  try {
    const failedEvents = await StreamEvent.find({
      processing_status: 'failed'
    });

    const retryResults = await Promise.allSettled(
      failedEvents.map(event => processEventAsync(event))
    );

    const successfulRetries = retryResults.filter(result => result.status === 'fulfilled').length;
    const failedRetries = retryResults.filter(result => result.status === 'rejected').length;

    res.json({
      success: true,
      data: {
        total_retried: failedEvents.length,
        successful: successfulRetries,
        failed: failedRetries,
        message: 'Retry process completed'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getStreamAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const [statusStats, sourceStats, throughputStats] = await Promise.all([
      StreamEvent.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$processing_status',
            count: { $sum: 1 },
            avg_processing_time: {
              $avg: {
                $subtract: ['$processed_at', '$timestamp']
              }
            }
          }
        }
      ]),
      StreamEvent.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$stream_source',
            count: { $sum: 1 },
            success_rate: {
              $avg: {
                $cond: [{ $eq: ['$processing_status', 'completed'] }, 1, 0]
              }
            }
          }
        }
      ]),
      StreamEvent.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: '$timestamp'
              }
            },
            events: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$processing_status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$processing_status', 'failed'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const analytics = {
      status_breakdown: statusStats.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          avg_processing_time: curr.avg_processing_time
        };
        return acc;
      }, {}),
      source_performance: sourceStats,
      throughput: throughputStats,
      overall_metrics: {
        total_events: statusStats.reduce((sum, curr) => sum + curr.count, 0),
        success_rate: statusStats.find(s => s._id === 'completed') ? 
          (statusStats.find(s => s._id === 'completed').count / statusStats.reduce((sum, curr) => sum + curr.count, 0)) * 100 : 0
      }
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

exports.bulkProcessEvents = async (req, res) => {
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
      event_id: event.event_id || `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp || new Date(),
      processing_status: 'pending'
    }));

    const result = await StreamEvent.insertMany(eventsWithIds, { ordered: false });

    // Process events asynchronously
    result.forEach(event => processEventAsync(event));

    res.status(202).json({
      success: true,
      data: {
        accepted_count: result.length,
        message: 'Events accepted for processing'
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};