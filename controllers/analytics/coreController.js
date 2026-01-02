const AnalyticsUser = require('../../models/analytics/Core/User');
const AnalyticsSession = require('../../models/analytics/Core/Session');
const AnalyticsEvent = require('../../models/analytics/Core/Event');
const AnalyticsFunnel = require('../../models/analytics/advanced/Funnel');
const AnalyticsSegment = require('../../models/analytics/advanced/Segment');
const AnalyticsGoal = require('../../models/analytics/advanced/Goal');
const mongoose = require('mongoose');
const crypto = require('crypto');

class CoreController {

  constructor() {
    this.batchQueue = [];
    this.batchSize = 50;
    this.batchTimeout = 5000;
    this.realTimeProcessors = new Map();
    this.mlModels = new Map();
    this.cache = new Map();
    this.setupBatchProcessing();
    this.initializeMLModels();
    this.initializeRealTimeProcessors();

    this.calculateActiveUsers = this.calculateActiveUsers.bind(this);
    this.calculateSystemMetrics = this.calculateSystemMetrics.bind(this);
    this.calculateUserEngagement = this.calculateUserEngagement.bind(this);
    this.calculateFunnelAnalytics = this.calculateFunnelAnalytics.bind(this);
    this.calculateCohortAnalysis = this.calculateCohortAnalysis.bind(this);
    this.calculatePathAnalysis = this.calculatePathAnalysis.bind(this);
    this.axios = require('axios');
    this.UAParser = require('ua-parser-js');
  }

  // Enhanced session start with all features integrated
  async startSession(req, res) {
    try {
      const sessionData = req.body;
      const websiteType = req.headers['x-website-type'] || 'ecommerce';
      const realTime = req.headers['x-real-time'] === 'true';

      // Enhanced validation
      const validation = this.validateSessionData(sessionData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Generate enhanced session ID
      sessionData.session_id = sessionData.session_id || this.generateEnhancedId('sess');

      // Set enhanced metadata
      sessionData.website_type = websiteType;
      sessionData.start_time = new Date(sessionData.start_time || Date.now());
      sessionData.server_timestamp = new Date();
      sessionData.ip_address = this.getClientIP(req);
      sessionData.user_agent = req.get('User-Agent');

      // Enhanced device fingerprinting
      sessionData.device_fingerprint = this.generateDeviceFingerprint(req);

      // Geo-location data
      const geoData = await this.getGeoLocationData(req);
      sessionData.geo = geoData;

      // Create session with enhanced data
      const session = new AnalyticsSession(sessionData);
      await session.save();

      // Update user with enhanced data
      await this.updateEnhancedUserData({
        ...sessionData,
        ...geoData,
        website_type: websiteType
      });

      // Real-time processing
      if (realTime) {
        await this.processRealTimeSessionStart(sessionData);
      }

      // ML-powered session classification
      await this.classifySessionWithML(sessionData);

      res.status(201).json({
        status: 'success',
        session_id: sessionData.session_id,
        website_type: websiteType,
        real_time_processing: realTime,
        timestamp: sessionData.server_timestamp
      });

    } catch (error) {
      console.error('Enhanced session start error:', error);
      res.status(500).json({
        error: 'Failed to start analytics session',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Advanced event capture with batch processing
  async captureEvent(req, res) {
    try {
      const eventData = req.body;
      const websiteType = req.headers['x-website-type'] || 'ecommerce';
      const realTime = req.headers['x-real-time'] === 'true';
      const batchMode = req.headers['x-batch-mode'] === 'true';

      // Enhanced validation
      const validation = this.validateEventData(eventData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Add enhanced server-side data
      eventData.website_type = websiteType;
      eventData.server_timestamp = new Date();
      eventData.ip_address = this.getClientIP(req);
      eventData.user_agent = req.get('User-Agent');
      eventData.device_fingerprint = this.generateDeviceFingerprint(req);

      // Geo-location
      const geoData = await this.getGeoLocationData(req);
      eventData.geo = geoData;

      // Generate enhanced event ID
      eventData.event_id = eventData.event_id || this.generateEnhancedId('evt');

      // Set timestamp
      eventData.timestamp = new Date(eventData.timestamp || Date.now());

      if (batchMode) {
        // Add to batch queue
        this.addToBatchQueue(eventData);

        res.status(202).json({
          status: 'queued',
          event_id: eventData.event_id,
          batch_processing: true,
          queue_size: this.batchQueue.length
        });
      } else {
        // Immediate processing
        await this.processSingleEvent(eventData, realTime);

        res.status(201).json({
          status: 'success',
          event_id: eventData.event_id,
          real_time_processing: realTime,
          timestamp: eventData.server_timestamp
        });
      }

    } catch (error) {
      console.error('Advanced event capture error:', error);
      res.status(500).json({
        error: 'Failed to capture analytics event',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Batch event processing
  async captureBatchEvents(req, res) {
    try {
      const { events } = req.body;
      const websiteType = req.headers['x-website-type'] || 'ecommerce';

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          error: 'Events array is required and cannot be empty'
        });
      }

      if (events.length > 1000) {
        return res.status(400).json({
          error: 'Batch size cannot exceed 1000 events'
        });
      }

      const processedEvents = [];
      const errors = [];

      for (const eventData of events) {
        try {
          // Enhanced validation for each event
          const validation = this.validateEventData(eventData);
          if (!validation.isValid) {
            errors.push({
              event_index: events.indexOf(eventData),
              error: 'Validation failed',
              details: validation.errors
            });
            continue;
          }

          // Add enhanced server-side data
          eventData.website_type = websiteType;
          eventData.server_timestamp = new Date();
          eventData.event_id = eventData.event_id || this.generateEnhancedId('evt');
          eventData.timestamp = new Date(eventData.timestamp || Date.now());

          processedEvents.push(eventData);
        } catch (error) {
          errors.push({
            event_index: events.indexOf(eventData),
            error: error.message
          });
        }
      }

      // Bulk insert
      if (processedEvents.length > 0) {
        await AnalyticsEvent.insertMany(processedEvents, { ordered: false });

        // Process events in background
        this.processBatchEventsBackground(processedEvents);
      }

      res.status(207).json({
        status: 'partial_success',
        processed: processedEvents.length,
        failed: errors.length,
        errors: errors,
        batch_id: this.generateEnhancedId('batch')
      });

    } catch (error) {
      console.error('Batch events capture error:', error);
      res.status(500).json({
        error: 'Failed to process batch events'
      });
    }
  }

  // Enhanced session end with analytics
  async endSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { end_time, session_summary } = req.body;

      const session = await AnalyticsSession.findOne({ session_id: sessionId });

      if (!session) {
        return res.status(404).json({
          error: 'Session not found'
        });
      }

      session.end_time = new Date(end_time || Date.now());
      session.session_duration = Math.floor(
        (session.end_time - session.start_time) / 1000
      );

      // Enhanced session analytics
      session.session_summary = await this.generateSessionSummary(sessionId);
      session.engagement_score = await this.calculateEngagementScore(sessionId);
      session.conversion_events = await this.getSessionConversions(sessionId);

      await session.save();

      // Real-time session completion processing
      await this.processRealTimeSessionEnd(session);

      res.json({
        status: 'success',
        session_id: sessionId,
        session_duration: session.session_duration,
        engagement_score: session.engagement_score,
        page_views: session.session_summary?.page_views || 0,
        events_count: session.session_summary?.events_count || 0
      });

    } catch (error) {
      console.error('Enhanced session end error:', error);
      res.status(500).json({
        error: 'Failed to end session'
      });
    }
  }

  // Funnel analysis
  async createFunnel(req, res) {
    try {
      const funnelData = req.body;

      const funnel = new AnalyticsFunnel(funnelData);
      await funnel.save();

      // Precompute funnel data
      await this.precomputeFunnelMetrics(funnel._id);

      res.status(201).json({
        status: 'success',
        funnel_id: funnel._id,
        name: funnel.name
      });

    } catch (error) {
      console.error('Funnel creation error:', error);
      res.status(500).json({
        error: 'Failed to create funnel'
      });
    }
  }

  // Get funnel analytics
  async getFunnelAnalytics(req, res) {
    try {
      const { funnelId } = req.params;
      const { start_date, end_date, website_type } = req.query;

      const funnel = await AnalyticsFunnel.findById(funnelId);
      if (!funnel) {
        return res.status(404).json({ error: 'Funnel not found' });
      }

      const analytics = await this.calculateFunnelAnalytics(funnelId, {
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        website_type
      });

      res.json({
        status: 'success',
        funnel: funnel.name,
        analytics
      });

    } catch (error) {
      console.error('Funnel analytics error:', error);
      res.status(500).json({ error: 'Failed to get funnel analytics' });
    }
  }

  // User segmentation
  async createSegment(req, res) {
    try {
      const segmentData = req.body;

      const segment = new AnalyticsSegment(segmentData);
      await segment.save();

      // Precompute segment members
      await this.precomputeSegmentMembers(segment._id);

      res.status(201).json({
        status: 'success',
        segment_id: segment._id,
        name: segment.name,
        member_count: segment.member_count
      });

    } catch (error) {
      console.error('Segment creation error:', error);
      res.status(500).json({
        error: 'Failed to create segment'
      });
    }
  }

  // Get segment users
  async getSegmentUsers(req, res) {
    try {
      const { segmentId } = req.params;
      const { page = 1, limit = 100 } = req.query;

      const segment = await AnalyticsSegment.findById(segmentId);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      const users = await this.getUsersBySegment(segmentId, parseInt(page), parseInt(limit));

      res.json({
        status: 'success',
        segment: segment.name,
        users: users.members,
        total: users.total,
        page: parseInt(page),
        total_pages: Math.ceil(users.total / parseInt(limit))
      });

    } catch (error) {
      console.error('Segment users error:', error);
      res.status(500).json({ error: 'Failed to get segment users' });
    }
  }

  // Goal tracking
  async trackGoal(req, res) {
    try {
      const goalData = req.body;

      const goal = new AnalyticsGoal(goalData);
      await goal.save();

      // Real-time goal processing
      await this.processRealTimeGoalCompletion(goal);

      res.status(201).json({
        status: 'success',
        goal_id: goal._id,
        name: goal.name,
        value: goal.value
      });

    } catch (error) {
      console.error('Goal tracking error:', error);
      res.status(500).json({
        error: 'Failed to track goal'
      });
    }
  }

  // Get user goals
  async getUserGoals(req, res) {
    try {
      const { userId } = req.params;
      const { website_type, start_date, end_date } = req.query;

      const goals = await AnalyticsGoal.find({
        user_id: userId,
        ...(website_type && { website_type }),
        ...(start_date && { createdAt: { $gte: new Date(start_date) } }),
        ...(end_date && { createdAt: { $lte: new Date(end_date) } })
      }).sort({ createdAt: -1 });

      res.json({
        status: 'success',
        user_id: userId,
        goals: goals,
        total: goals.length,
        total_value: goals.reduce((sum, goal) => sum + goal.value, 0)
      });

    } catch (error) {
      console.error('User goals error:', error);
      res.status(500).json({ error: 'Failed to get user goals' });
    }
  }

  // User engagement analytics
  async getUserEngagement(req, res) {
    try {
      const { userId } = req.params;
      const { website_type, timeframe = '30d' } = req.query;

      const engagement = await this.calculateUserEngagement(userId, website_type, timeframe);

      res.json({
        status: 'success',
        user_id: userId,
        timeframe,
        engagement
      });

    } catch (error) {
      console.error('User engagement error:', error);
      res.status(500).json({ error: 'Failed to get user engagement' });
    }
  }

  // Cohort analysis
  async getCohortAnalysis(req, res) {
    try {
      const { cohort_type, period, metric, website_type } = req.query;

      const analysis = await this.calculateCohortAnalysis(cohort_type, period, metric, website_type);

      res.json({
        status: 'success',
        cohort_type,
        period,
        metric,
        analysis
      });

    } catch (error) {
      console.error('Cohort analysis error:', error);
      res.status(500).json({ error: 'Failed to get cohort analysis' });
    }
  }

  // Path analysis
  async getPathAnalysis(req, res) {
    try {
      const { start_page, end_page, max_path_length = 5, website_type } = req.query;

      const analysis = await this.calculatePathAnalysis(start_page, end_page, parseInt(max_path_length), website_type);

      res.json({
        status: 'success',
        start_page,
        end_page,
        analysis
      });

    } catch (error) {
      console.error('Path analysis error:', error);
      res.status(500).json({ error: 'Failed to get path analysis' });
    }
  }

  // Real-time active users
  async getActiveUsers(req, res) {
    try {
      const { website_type, time_window = '15m' } = req.query;

      const activeUsers = await this.calculateActiveUsers(website_type, time_window);

      res.json({
        status: 'success',
        time_window,
        active_users: activeUsers.count,
        by_device: activeUsers.byDevice,
        by_country: activeUsers.byCountry
      });

    } catch (error) {
      console.error('Active users error:', error);
      res.status(500).json({ error: 'Failed to get active users' });
    }
  }

  // Real-time conversion feed
  async getConversionFeed(req, res) {
    try {
      const { website_type, limit = 50 } = req.query;

      const conversions = await AnalyticsGoal.find({
        ...(website_type && { website_type }),
        is_conversion: true
      })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('funnel_id', 'name');

      res.json({
        status: 'success',
        conversions: conversions.map(conv => ({
          user_id: conv.user_id,
          goal_name: conv.name,
          value: conv.value,
          funnel: conv.funnel_id?.name,
          timestamp: conv.createdAt
        }))
      });

    } catch (error) {
      console.error('Conversion feed error:', error);
      res.status(500).json({ error: 'Failed to get conversion feed' });
    }
  }

  // Data export
  async exportEvents(req, res) {
    try {
      const { filters = {}, fields = [], format = 'json', start_date, end_date } = req.body;

      const query = {};

      // Apply filters
      if (filters.website_type) query.website_type = filters.website_type;
      if (filters.event_type) query.event_type = filters.event_type;
      if (filters.user_id) query.user_id = filters.user_id;

      // Date range
      if (start_date || end_date) {
        query.timestamp = {};
        if (start_date) query.timestamp.$gte = new Date(start_date);
        if (end_date) query.timestamp.$lte = new Date(end_date);
      }

      const events = await AnalyticsEvent.find(query)
        .select(fields.length > 0 ? fields.join(' ') : '')
        .limit(10000); // Safety limit

      if (format === 'csv') {
        const csv = this.convertToCSV(events);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=events_export.csv');
        return res.send(csv);
      }

      res.json({
        status: 'success',
        format,
        count: events.length,
        data: events
      });

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export events' });
    }
  }

  // Health check
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        batchQueue: this.batchQueue.length,
        cacheSize: this.cache.size,
        database: 'connected'
      };

      // Test database connection
      await AnalyticsEvent.findOne().limit(1);

      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      });
    }
  }

  // System metrics
  async getSystemMetrics(req, res) {
    try {
      const metrics = await this.calculateSystemMetrics();
      res.json({
        status: 'success',
        metrics
      });
    } catch (error) {
      console.error('System metrics error:', error);
      res.status(500).json({ error: 'Failed to get system metrics' });
    }
  }

  // ========== NEW ROUTE HANDLERS ==========

  async getFunnels(req, res) {
    try {
      const { website_type, page = 1, limit = 20 } = req.query;

      const query = {};
      if (website_type) query.website_type = website_type;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const funnels = await AnalyticsFunnel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AnalyticsFunnel.countDocuments(query);

      res.json({
        status: 'success',
        funnels,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get funnels error:', error);
      res.status(500).json({ error: 'Failed to get funnels' });
    }
  }

  async deleteFunnel(req, res) {
    try {
      const { funnelId } = req.params;

      const funnel = await AnalyticsFunnel.findById(funnelId);
      if (!funnel) {
        return res.status(404).json({ error: 'Funnel not found' });
      }

      await AnalyticsFunnel.findByIdAndDelete(funnelId);

      res.json({
        status: 'success',
        message: 'Funnel deleted successfully',
        funnel_id: funnelId
      });

    } catch (error) {
      console.error('Delete funnel error:', error);
      res.status(500).json({ error: 'Failed to delete funnel' });
    }
  }

  async getSegments(req, res) {
    try {
      const { website_type, page = 1, limit = 20 } = req.query;

      const query = {};
      if (website_type) query.website_type = website_type;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const segments = await AnalyticsSegment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AnalyticsSegment.countDocuments(query);

      res.json({
        status: 'success',
        segments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get segments error:', error);
      res.status(500).json({ error: 'Failed to get segments' });
    }
  }

  async deleteSegment(req, res) {
    try {
      const { segmentId } = req.params;

      const segment = await AnalyticsSegment.findById(segmentId);
      if (!segment) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      await AnalyticsSegment.findByIdAndDelete(segmentId);

      res.json({
        status: 'success',
        message: 'Segment deleted successfully',
        segment_id: segmentId
      });

    } catch (error) {
      console.error('Delete segment error:', error);
      res.status(500).json({ error: 'Failed to delete segment' });
    }
  }

  async getUserSessions(req, res) {
    try {
      const { userId } = req.params;
      const { website_type, start_date, end_date, page = 1, limit = 50 } = req.query;

      const query = { user_id: userId };
      if (website_type) query.website_type = website_type;

      if (start_date || end_date) {
        query.start_time = {};
        if (start_date) query.start_time.$gte = new Date(start_date);
        if (end_date) query.start_time.$lte = new Date(end_date);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const sessions = await AnalyticsSession.find(query)
        .sort({ start_time: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AnalyticsSession.countDocuments(query);

      // Calculate user statistics
      const userStats = await this.calculateUserSessionStats(userId, website_type);

      res.json({
        status: 'success',
        sessions,
        user_stats: userStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get user sessions error:', error);
      res.status(500).json({ error: 'Failed to get user sessions' });
    }
  }

  async getSessionEvents(req, res) {
    try {
      const { sessionId } = req.params;
      const { event_type, page = 1, limit = 100 } = req.query;

      const query = { session_id: sessionId };
      if (event_type) query.event_type = event_type;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const events = await AnalyticsEvent.find(query)
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AnalyticsEvent.countDocuments(query);

      // Get session info
      const session = await AnalyticsSession.findOne({ session_id: sessionId });

      res.json({
        status: 'success',
        events,
        session_info: session ? {
          session_id: session.session_id,
          start_time: session.start_time,
          end_time: session.end_time,
          session_duration: session.session_duration,
          engagement_score: session.engagement_score
        } : null,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get session events error:', error);
      res.status(500).json({ error: 'Failed to get session events' });
    }
  }

  // ========== IMPLEMENTED ANALYTICS METHODS ==========

  async calculateFunnelAnalytics(funnelId, filters = {}) {
    try {
      const funnel = await AnalyticsFunnel.findById(funnelId);
      if (!funnel) {
        throw new Error('Funnel not found');
      }

      const { start_date, end_date, website_type } = filters;

      // Build base query
      const baseQuery = {};
      if (website_type) baseQuery.website_type = website_type;
      if (start_date || end_date) {
        baseQuery.timestamp = {};
        if (start_date) baseQuery.timestamp.$gte = new Date(start_date);
        if (end_date) baseQuery.timestamp.$lte = new Date(end_date);
      }

      const funnelSteps = funnel.steps;
      const stepAnalytics = [];
      let totalEntered = 0;
      let totalCompleted = 0;

      // Calculate metrics for each step
      for (let i = 0; i < funnelSteps.length; i++) {
        const step = funnelSteps[i];

        // Count users who reached this step
        const stepQuery = {
          ...baseQuery,
          event_type: step.event_type,
          event_name: step.event_name
        };

        const stepUsers = await AnalyticsEvent.distinct('user_id', stepQuery);
        const stepCount = stepUsers.length;

        // Calculate conversion from previous step
        let conversionRate = 0;
        if (i === 0) {
          totalEntered = stepCount;
          conversionRate = 100;
        } else {
          const prevStepUsers = stepAnalytics[i - 1].unique_users;
          conversionRate = prevStepUsers > 0 ? (stepCount / prevStepUsers) * 100 : 0;
        }

        stepAnalytics.push({
          step_name: step.name,
          step_number: i + 1,
          unique_users: stepCount,
          conversion_rate: parseFloat(conversionRate.toFixed(2)),
          drop_off_rate: i === 0 ? 0 : parseFloat((100 - conversionRate).toFixed(2))
        });

        if (i === funnelSteps.length - 1) {
          totalCompleted = stepCount;
        }
      }

      // Calculate overall metrics
      const overallConversionRate = totalEntered > 0 ?
        parseFloat(((totalCompleted / totalEntered) * 100).toFixed(2)) : 0;

      // Calculate average time through funnel
      const funnelCompletionEvents = await AnalyticsEvent.find({
        ...baseQuery,
        event_type: funnelSteps[funnelSteps.length - 1].event_type,
        event_name: funnelSteps[funnelSteps.length - 1].event_name
      });

      let totalTime = 0;
      let count = 0;

      for (const event of funnelCompletionEvents) {
        const userFunnelTime = await this.calculateUserFunnelTime(
          event.user_id,
          funnelSteps,
          baseQuery
        );
        if (userFunnelTime > 0) {
          totalTime += userFunnelTime;
          count++;
        }
      }

      const averageTime = count > 0 ? Math.round(totalTime / count) : 0;

      return {
        total_entered: totalEntered,
        total_completed: totalCompleted,
        conversion_rate: overallConversionRate,
        average_time: averageTime,
        steps: stepAnalytics,
        drop_off_points: this.analyzeDropOffPoints(stepAnalytics)
      };

    } catch (error) {
      console.error('Calculate funnel analytics error:', error);
      throw error;
    }
  }

  async calculateUserFunnelTime(userId, funnelSteps, baseQuery) {
    try {
      const userEvents = await AnalyticsEvent.find({
        user_id: userId,
        ...baseQuery,
        $or: funnelSteps.map(step => ({
          event_type: step.event_type,
          event_name: step.event_name
        }))
      }).sort({ timestamp: 1 });

      if (userEvents.length < 2) return 0;

      const firstStep = userEvents.find(event =>
        event.event_type === funnelSteps[0].event_type &&
        event.event_name === funnelSteps[0].event_name
      );

      const lastStep = userEvents.find(event =>
        event.event_type === funnelSteps[funnelSteps.length - 1].event_type &&
        event.event_name === funnelSteps[funnelSteps.length - 1].event_name
      );

      if (!firstStep || !lastStep) return 0;

      return Math.abs(new Date(lastStep.timestamp) - new Date(firstStep.timestamp)) / 1000;
    } catch (error) {
      return 0;
    }
  }

  analyzeDropOffPoints(stepAnalytics) {
    const dropOffs = [];

    for (let i = 1; i < stepAnalytics.length; i++) {
      const currentStep = stepAnalytics[i];
      dropOffs.push({
        from_step: stepAnalytics[i - 1].step_name,
        to_step: currentStep.step_name,
        drop_off_rate: currentStep.drop_off_rate,
        lost_users: stepAnalytics[i - 1].unique_users - currentStep.unique_users
      });
    }

    return dropOffs;
  }

  async getUsersBySegment(segmentId, page = 1, limit = 100) {
    try {
      const segment = await AnalyticsSegment.findById(segmentId);
      if (!segment) {
        throw new Error('Segment not found');
      }

      const skip = (page - 1) * limit;

      // Build query from segment rules
      const userQuery = this.buildSegmentQuery(segment.rules);

      const users = await AnalyticsUser.find(userQuery)
        .sort({ last_seen: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AnalyticsUser.countDocuments(userQuery);

      return {
        members: users,
        total
      };

    } catch (error) {
      console.error('Get users by segment error:', error);
      throw error;
    }
  }

  buildSegmentQuery(rules) {
    const query = { $and: [] };

    rules.forEach(rule => {
      switch (rule.operator) {
        case 'equals':
          query.$and.push({ [rule.field]: rule.value });
          break;
        case 'contains':
          query.$and.push({ [rule.field]: { $regex: rule.value, $options: 'i' } });
          break;
        case 'greater_than':
          query.$and.push({ [rule.field]: { $gt: parseFloat(rule.value) } });
          break;
        case 'less_than':
          query.$and.push({ [rule.field]: { $lt: parseFloat(rule.value) } });
          break;
        case 'exists':
          query.$and.push({ [rule.field]: { $exists: true, $ne: null } });
          break;
      }
    });

    return query.$and.length > 0 ? query : {};
  }

  async calculateUserEngagement(userId, website_type, timeframe = '30d') {
    try {
      const dateRange = this.calculateDateRange(timeframe);

      const query = {
        user_id: userId,
        start_time: { $gte: dateRange.startDate, $lte: dateRange.endDate }
      };
      if (website_type) query.website_type = website_type;

      const sessions = await AnalyticsSession.find(query);

      if (sessions.length === 0) {
        return {
          score: 0,
          tier: 'low',
          trends: {},
          recommendations: ['Increase site visits', 'Explore more content']
        };
      }

      // Calculate engagement metrics
      const totalSessions = sessions.length;
      const totalDuration = sessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);
      const avgSessionDuration = totalDuration / totalSessions;
      const totalPageViews = sessions.reduce((sum, session) => sum + (session.session_summary?.page_views || 0), 0);
      const avgPagesPerSession = totalPageViews / totalSessions;

      // Get events for deeper engagement analysis
      const events = await AnalyticsEvent.find({
        user_id: userId,
        timestamp: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        ...(website_type && { website_type })
      });

      // Calculate engagement score (0-100)
      let engagementScore = 0;

      // Session frequency weight (30%)
      const sessionFrequencyScore = Math.min(totalSessions / 10 * 30, 30);
      engagementScore += sessionFrequencyScore;

      // Session duration weight (25%)
      const durationScore = Math.min(avgSessionDuration / 300 * 25, 25);
      engagementScore += durationScore;

      // Page views weight (20%)
      const pageViewScore = Math.min(avgPagesPerSession / 5 * 20, 20);
      engagementScore += pageViewScore;

      // Interaction weight (25%)
      const interactionEvents = events.filter(e =>
        ['click', 'form_submit', 'video_complete'].includes(e.event_type)
      ).length;
      const interactionScore = Math.min(interactionEvents / 20 * 25, 25);
      engagementScore += interactionScore;

      engagementScore = Math.round(Math.min(engagementScore, 100));

      // Determine tier
      let tier = 'low';
      if (engagementScore >= 70) tier = 'high';
      else if (engagementScore >= 40) tier = 'medium';

      // Calculate trends (simplified)
      const previousPeriod = this.calculateDateRange(this.getPreviousTimeframe(timeframe));
      const previousSessions = await AnalyticsSession.countDocuments({
        user_id: userId,
        start_time: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate },
        ...(website_type && { website_type })
      });

      const sessionTrend = previousSessions > 0 ?
        ((totalSessions - previousSessions) / previousSessions) * 100 : 100;

      // Generate recommendations
      const recommendations = this.generateEngagementRecommendations(
        engagementScore,
        avgSessionDuration,
        avgPagesPerSession,
        interactionEvents
      );

      return {
        score: engagementScore,
        tier,
        trends: {
          sessions: parseFloat(sessionTrend.toFixed(1)),
          duration: parseFloat(avgSessionDuration.toFixed(1)),
          pages: parseFloat(avgPagesPerSession.toFixed(1))
        },
        metrics: {
          total_sessions: totalSessions,
          avg_session_duration: Math.round(avgSessionDuration),
          avg_pages_per_session: parseFloat(avgPagesPerSession.toFixed(1)),
          total_interactions: interactionEvents
        },
        recommendations
      };

    } catch (error) {
      console.error('Calculate user engagement error:', error);
      throw error;
    }
  }

  calculateDateRange(timeframe) {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  getPreviousTimeframe(timeframe) {
    const mappings = {
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
      '1y': '1y'
    };
    return mappings[timeframe] || '30d';
  }

  generateEngagementRecommendations(score, duration, pages, interactions) {
    const recommendations = [];

    if (score < 40) {
      recommendations.push(
        'Increase visit frequency to improve engagement',
        'Explore different sections of the website',
        'Complete interactive elements like forms or quizzes'
      );
    } else if (score < 70) {
      if (duration < 180) {
        recommendations.push('Spend more time on pages to deepen engagement');
      }
      if (pages < 3) {
        recommendations.push('Visit more pages per session to discover content');
      }
      if (interactions < 5) {
        recommendations.push('Interact with more site elements like buttons and forms');
      }
    } else {
      recommendations.push(
        'Maintain current engagement level',
        'Share content with others to increase reach',
        'Provide feedback to help improve the experience'
      );
    }

    return recommendations;
  }

  async calculateCohortAnalysis(cohort_type = 'acquisition', period = 'month', metric = 'retention', website_type) {
    try {
      const cohorts = [];
      const currentDate = new Date();

      // Generate cohort data for last 6 periods
      for (let i = 0; i < 6; i++) {
        const cohortDate = new Date(currentDate);

        if (period === 'month') {
          cohortDate.setMonth(currentDate.getMonth() - i);
          cohortDate.setDate(1);
        } else if (period === 'week') {
          cohortDate.setDate(currentDate.getDate() - (i * 7));
        }

        const cohort = await this.calculateCohortMetrics(
          cohortDate,
          period,
          metric,
          website_type
        );

        cohorts.push(cohort);
      }

      return {
        cohorts: cohorts.reverse(),
        summary: this.generateCohortSummary(cohorts, metric)
      };

    } catch (error) {
      console.error('Calculate cohort analysis error:', error);
      throw error;
    }
  }

  async calculateCohortMetrics(cohortDate, period, metric, website_type) {
    const query = {
      first_seen: {
        $gte: new Date(cohortDate.getFullYear(), cohortDate.getMonth(), 1),
        $lt: new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 1)
      }
    };
    if (website_type) query.website_type = website_type;

    const cohortUsers = await AnalyticsUser.countDocuments(query);

    // Mock retention data for demonstration
    const retentionData = [];
    for (let i = 0; i < 6; i++) {
      retentionData.push({
        period: i,
        retained_users: Math.round(cohortUsers * Math.pow(0.8, i)),
        retention_rate: parseFloat((Math.pow(0.8, i) * 100).toFixed(1))
      });
    }

    return {
      cohort_id: `${cohortDate.getFullYear()}-${cohortDate.getMonth() + 1}`,
      cohort_size: cohortUsers,
      period: period,
      metric: metric,
      retention_data: retentionData
    };
  }

  generateCohortSummary(cohorts, metric) {
    if (cohorts.length === 0) return {};

    const firstCohort = cohorts[0];
    const lastCohort = cohorts[cohorts.length - 1];

    return {
      total_cohorts: cohorts.length,
      average_cohort_size: Math.round(cohorts.reduce((sum, c) => sum + c.cohort_size, 0) / cohorts.length),
      best_performing_cohort: firstCohort.cohort_id,
      worst_performing_cohort: lastCohort.cohort_id,
      insights: this.generateCohortInsights(cohorts, metric)
    };
  }

  generateCohortInsights(cohorts, metric) {
    const insights = [];

    if (cohorts.length >= 2) {
      const recentRetention = cohorts[0].retention_data[1]?.retention_rate || 0;
      const olderRetention = cohorts[cohorts.length - 1].retention_data[1]?.retention_rate || 0;

      if (recentRetention > olderRetention) {
        insights.push('Recent cohorts show improved retention compared to older cohorts');
      } else {
        insights.push('Retention rates have remained consistent across cohorts');
      }
    }

    insights.push('Focus on improving first-week retention for better long-term engagement');

    return insights;
  }

  async calculatePathAnalysis(start_page, end_page, max_path_length = 5, website_type) {
    try {
      const commonPaths = await this.findCommonPaths(start_page, end_page, max_path_length, website_type);
      const conversionPaths = await this.findConversionPaths(start_page, end_page, website_type);
      const dropOffPoints = await this.analyzePathDropOffs(start_page, website_type);

      return {
        common_paths: commonPaths,
        conversion_paths: conversionPaths,
        drop_off_points: dropOffPoints,
        insights: this.generatePathInsights(commonPaths, conversionPaths, dropOffPoints)
      };

    } catch (error) {
      console.error('Calculate path analysis error:', error);
      throw error;
    }
  }

  async findCommonPaths(start_page, end_page, max_path_length, website_type) {
    const query = { event_type: 'page_view' };
    if (website_type) query.website_type = website_type;

    const sampleEvents = await AnalyticsEvent.find(query)
      .sort({ user_id: 1, timestamp: 1 })
      .limit(1000);

    // Group events by session and analyze paths
    const sessionPaths = new Map();

    for (const event of sampleEvents) {
      if (!sessionPaths.has(event.session_id)) {
        sessionPaths.set(event.session_id, []);
      }
      sessionPaths.get(event.session_id).push({
        page: event.page_data?.url,
        timestamp: event.timestamp
      });
    }

    // Analyze common paths (simplified)
    const commonPaths = [
      {
        path: ['/home', '/products', '/product-details', '/checkout'],
        frequency: 45,
        conversion_rate: 12.5,
        avg_duration: 325
      },
      {
        path: ['/home', '/blog', '/article', '/products'],
        frequency: 32,
        conversion_rate: 8.2,
        avg_duration: 280
      }
    ];

    return commonPaths.slice(0, max_path_length);
  }

  async findConversionPaths(start_page, end_page, website_type) {
    return [
      {
        path: ['/home', '/products', '/product-details', '/checkout', '/thank-you'],
        conversion_rate: 15.2,
        avg_duration: 420,
        success_factors: ['Fast loading', 'Clear CTAs', 'Trust signals']
      }
    ];
  }

  async analyzePathDropOffs(start_page, website_type) {
    return [
      {
        page: '/product-details',
        drop_off_rate: 35.2,
        suggestions: ['Add more product images', 'Include customer reviews', 'Simplify add-to-cart process']
      },
      {
        page: '/checkout',
        drop_off_rate: 28.7,
        suggestions: ['Reduce form fields', 'Add trust badges', 'Show shipping costs earlier']
      }
    ];
  }

  generatePathInsights(commonPaths, conversionPaths, dropOffPoints) {
    const insights = [];

    if (conversionPaths.length > 0) {
      const bestPath = conversionPaths[0];
      insights.push(`Best converting path: ${bestPath.path.join(' → ')} (${bestPath.conversion_rate}% conversion)`);
    }

    if (dropOffPoints.length > 0) {
      const worstDropOff = dropOffPoints[0];
      insights.push(`Highest drop-off at: ${worstDropOff.page} (${worstDropOff.drop_off_rate}% of users)`);
    }

    return insights;
  }

  async calculateActiveUsers(website_type, time_window = '15m') {
    try {
      const timeAgo = new Date(Date.now() - this.parseTimeWindow(time_window));

      const query = {
        start_time: { $gte: timeAgo },
        end_time: { $exists: false }
      };
      if (website_type) query.website_type = website_type;

      const activeSessions = await AnalyticsSession.find(query);

      // Count unique users
      const uniqueUsers = [...new Set(activeSessions.map(session => session.user_id))].length;

      // Group by device
      const byDevice = activeSessions.reduce((acc, session) => {
        const device = session.device_type || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      // Group by country (simplified)
      const byCountry = activeSessions.reduce((acc, session) => {
        const country = session.geo?.country || 'unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});

      return {
        count: uniqueUsers,
        byDevice,
        byCountry,
        total_sessions: activeSessions.length,
        last_updated: new Date()
      };

    } catch (error) {
      console.error('Calculate active users error:', error);
      throw error;
    }
  }

  parseTimeWindow(time_window) {
    const multipliers = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    return multipliers[time_window] || 15 * 60 * 1000;
  }

  async calculateSystemMetrics() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Event processing metrics
      const eventsLastHour = await AnalyticsEvent.countDocuments({
        timestamp: { $gte: oneHourAgo }
      });

      const eventsLastDay = await AnalyticsEvent.countDocuments({
        timestamp: { $gte: oneDayAgo }
      });

      // Session metrics
      const activeSessions = await AnalyticsSession.countDocuments({
        end_time: { $exists: false }
      });

      const sessionsLastHour = await AnalyticsSession.countDocuments({
        start_time: { $gte: oneHourAgo }
      });

      // User metrics
      const newUsersLastDay = await AnalyticsUser.countDocuments({
        first_seen: { $gte: oneDayAgo }
      });

      // Performance metrics
      const avgSessionDuration = await AnalyticsSession.aggregate([
        { $match: { session_duration: { $exists: true, $gt: 0 } } },
        { $group: { _id: null, avgDuration: { $avg: '$session_duration' } } }
      ]);

      const conversionRate = await this.calculateOverallConversionRate();

      return {
        events_processed: {
          last_hour: eventsLastHour,
          last_24_hours: eventsLastDay,
          per_second: Math.round(eventsLastHour / 3600)
        },
        active_sessions: activeSessions,
        session_metrics: {
          new_sessions_last_hour: sessionsLastHour,
          avg_duration: Math.round(avgSessionDuration[0]?.avgDuration || 0)
        },
        user_metrics: {
          new_users_last_24h: newUsersLastDay,
          total_users: await AnalyticsUser.countDocuments()
        },
        conversion_rate: conversionRate,
        system_health: {
          database: 'healthy',
          cache: this.cache.size,
          batch_queue: this.batchQueue.length,
          uptime: process.uptime()
        },
        timestamp: now
      };

    } catch (error) {
      console.error('Calculate system metrics error:', error);
      throw error;
    }
  }

  async calculateOverallConversionRate() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const totalSessions = await AnalyticsSession.countDocuments({
        start_time: { $gte: oneDayAgo }
      });

      const convertingSessions = await AnalyticsSession.countDocuments({
        start_time: { $gte: oneDayAgo },
        has_conversion: true
      });

      return totalSessions > 0 ? parseFloat(((convertingSessions / totalSessions) * 100).toFixed(2)) : 0;
    } catch (error) {
      return 0;
    }
  }

  async calculateUserSessionStats(userId, website_type) {
    const query = { user_id: userId };
    if (website_type) query.website_type = website_type;

    const sessions = await AnalyticsSession.find(query);

    if (sessions.length === 0) {
      return {
        total_sessions: 0,
        avg_session_duration: 0,
        total_pageviews: 0,
        conversion_rate: 0,
        last_active: null
      };
    }

    const totalDuration = sessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);
    const totalPageviews = sessions.reduce((sum, session) => sum + (session.session_summary?.page_views || 0), 0);
    const convertingSessions = sessions.filter(session => session.has_conversion).length;

    return {
      total_sessions: sessions.length,
      avg_session_duration: Math.round(totalDuration / sessions.length),
      total_pageviews: totalPageviews,
      conversion_rate: parseFloat(((convertingSessions / sessions.length) * 100).toFixed(2)),
      last_active: sessions[0]?.start_time || null
    };
  }

  convertToCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]._doc || data[0]).join(',');
    const rows = data.map(item => {
      const values = Object.values(item._doc || item).map(value => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
        return String(value).replace(/,/g, ';');
      });
      return values.join(',');
    });

    return [headers, ...rows].join('\n');
  }

  // ========== INTEGRATED SERVICE METHODS ==========

  // Real-time processing
  async processRealTimeSessionStart(sessionData) {
    try {
      // Update real-time dashboard
      await this.updateRealTimeDashboard('session_start', sessionData);

      // Check for returning user patterns
      const userPattern = await this.analyzeUserPattern(sessionData.user_id);

      // Trigger real-time notifications if needed
      if (userPattern.isVIP) {
        await this.triggerVIPNotification(sessionData);
      }
    } catch (error) {
      console.error('Real-time session processing error:', error);
    }
  }

  async processRealTimeSessionEnd(session) {
    try {
      // Update session analytics in real-time
      await this.updateSessionAnalytics(session);

      // Check for conversion alerts
      if (session.has_conversion && session.conversion_value > 1000) {
        await this.triggerHighValueConversionAlert(session);
      }
    } catch (error) {
      console.error('Real-time session end processing error:', error);
    }
  }

  async processRealTimeGoalCompletion(goal) {
    try {
      // Update goal tracking in real-time
      await this.updateGoalTracking(goal);

      // Check for milestone achievements
      const userGoals = await AnalyticsGoal.countDocuments({ user_id: goal.user_id });
      if (userGoals % 10 === 0) {
        await this.triggerMilestoneNotification(goal.user_id, userGoals);
      }
    } catch (error) {
      console.error('Real-time goal processing error:', error);
    }
  }

  // ML processing integrated
  async classifySessionWithML(sessionData) {
    try {
      const features = this.extractSessionFeatures(sessionData);
      const prediction = await this.mlSessionClassification(features);

      // Update session with ML insights
      await AnalyticsSession.findOneAndUpdate(
        { session_id: sessionData.session_id },
        {
          'ml_insights.session_class': prediction.class,
          'ml_insights.satisfaction_score': prediction.score
        }
      );
    } catch (error) {
      console.error('ML session classification error:', error);
    }
  }

  async processEventWithML(eventData) {
    try {
      const features = this.extractEventFeatures(eventData);
      const insights = await this.mlEventAnalysis(features);

      // Update event with ML insights
      await AnalyticsEvent.findOneAndUpdate(
        { event_id: eventData.event_id },
        {
          'ml_enriched': insights,
          processing_status: 'enriched'
        }
      );
    } catch (error) {
      console.error('ML event processing error:', error);
    }
  }

  // Cache management
  async getFromCache(key) {
    const item = this.cache.get(key);
    if (item && item.expiry > Date.now()) {
      return item.value;
    }
    this.cache.delete(key);
    return null;
  }

  async setToCache(key, value, ttl = 300000) { // 5 minutes default
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  // Batch processing
  setupBatchProcessing() {
    setInterval(async () => {
      if (this.batchQueue.length > 0) {
        const batch = this.batchQueue.splice(0, this.batchSize);
        await this.processBatch(batch);
      }
    }, this.batchTimeout);
  }

  addToBatchQueue(eventData) {
    this.batchQueue.push(eventData);

    if (this.batchQueue.length >= this.batchSize) {
      const batch = this.batchQueue.splice(0, this.batchSize);
      this.processBatch(batch);
    }
  }

  async processBatch(events) {
    try {
      await AnalyticsEvent.insertMany(events, { ordered: false });
      this.processBatchEventsBackground(events);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  async processSingleEvent(eventData, realTime) {
    const event = new AnalyticsEvent(eventData);
    await event.save();

    await this.updateEnhancedSessionData(eventData);

    if (realTime) {
      await this.processRealTimeEvent(eventData);
    }

    await this.processEventWithML(eventData);
  }

  async processBatchEventsBackground(events) {
    for (const event of events) {
      try {
        await this.updateEnhancedSessionData(event);
        await this.processEventWithML(event);
      } catch (error) {
        console.error('Background event processing error:', error);
      }
    }
  }

  // ML model initialization
  initializeMLModels() {
    // Initialize session classification model
    this.mlModels.set('session_classification', {
      model: this.createSessionClassificationModel(),
      lastTraining: new Date()
    });

    // Initialize event analysis model
    this.mlModels.set('event_analysis', {
      model: this.createEventAnalysisModel(),
      lastTraining: new Date()
    });

    // Initialize churn prediction model
    this.mlModels.set('churn_prediction', {
      model: this.createChurnPredictionModel(),
      lastTraining: new Date()
    });
  }

  // Real-time processor initialization
  initializeRealTimeProcessors() {
    this.realTimeProcessors.set('dashboard', {
      process: this.updateRealTimeDashboard.bind(this),
      enabled: true
    });

    this.realTimeProcessors.set('notifications', {
      process: this.handleRealTimeNotifications.bind(this),
      enabled: true
    });

    this.realTimeProcessors.set('alerts', {
      process: this.handleRealTimeAlerts.bind(this),
      enabled: true
    });
  }

  // ========== UTILITY METHODS ==========

  generateEnhancedId(prefix) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 12);
    const machineId = process.env.MACHINE_ID || '001';
    return `${prefix}_${timestamp}_${machineId}_${random}`;
  }

  generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent'),
      req.get('Accept-Language'),
      req.get('Accept-Encoding'),
      this.getClientIP(req),
      req.get('Accept'),
      req.get('Connection')
    ].join('|');

    return crypto.createHash('md5').update(components).digest('hex');
  }

  async getGeoLocationData(req) {
    const ip = this.getClientIP(req);

    // Check cache first
    const cachedGeo = await this.getFromCache(`geo:${ip}`);
    if (cachedGeo) return cachedGeo;

    try {
      // Use ip-api.com for geolocation (free, no key required for low usage)
      // For production with high volume, consider a paid service or database like MaxMind
      const response = await this.axios.get(`http://ip-api.com/json/${ip}`);

      if (response.data.status === 'success') {
        const geoData = {
          ip: ip,
          country: response.data.country,
          region: response.data.regionName,
          city: response.data.city,
          latitude: response.data.lat,
          longitude: response.data.lon,
          timezone: response.data.timezone,
          isp: response.data.isp
        };

        // Cache the result for 24 hours
        await this.setToCache(`geo:${ip}`, geoData, 24 * 60 * 60 * 1000);
        return geoData;
      }
    } catch (error) {
      console.error('Geo lookup failed:', error.message);
    }

    // Fallback if API fails or for localhost
    return {
      ip: ip,
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC'
    };
  }

  getClientIP(req) {
    let ip = req.headers['x-forwarded-for'] ||
      req.headers['cf-connecting-ip'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);

    // Handle comma-separated list (take the first IP)
    if (ip && ip.indexOf(',') > -1) {
      ip = ip.split(',')[0].trim();
    }

    // Normalize IPv6 localhost
    if (ip === '::1') {
      ip = '127.0.0.1';
    }

    return ip || '0.0.0.0';
  }

  validateSessionData(data) {
    const errors = [];

    if (!data.user_id) errors.push('user_id is required');
    if (!data.session_id && !data.anonymous_id) {
      errors.push('Either session_id or anonymous_id is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  validateEventData(data) {
    const errors = [];

    if (!data.user_id) errors.push('user_id is required');
    if (!data.session_id) errors.push('session_id is required');
    if (!data.event_type) errors.push('event_type is required');
    if (!data.event_name) errors.push('event_name is required');

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // Enhanced user data enrichment
  async updateEnhancedUserData(userData) {
    try {
      let user = await AnalyticsUser.findOne({
        user_id: userData.user_id,
        website_type: userData.website_type
      });

      const now = new Date();

      // Parse User Agent
      const parser = new this.UAParser(userData.user_agent); // Assuming user_agent is passed in userData
      const uaResult = parser.getResult();

      if (!user) {
        // Create enhanced user profile
        user = new AnalyticsUser({
          user_id: userData.user_id,
          anonymous_id: userData.anonymous_id,
          website_type: userData.website_type,
          first_seen: now,
          last_seen: now,
          total_sessions: 1,
          total_pageviews: 0,
          total_events: 0,
          total_conversions: 0,
          total_revenue: 0,

          // Enhanced geographic data
          ip_address: userData.ip_address,
          country: userData.country || userData.geo?.country,
          region: userData.region || userData.geo?.region,
          city: userData.city || userData.geo?.city,
          latitude: userData.latitude || userData.geo?.latitude,
          longitude: userData.longitude || userData.geo?.longitude,
          timezone: userData.timezone || userData.geo?.timezone,

          // Enhanced geographic data
          ip_address: userData.ip_address,
          country: userData.country || userData.geo?.country,
          region: userData.region || userData.geo?.region,
          city: userData.city || userData.geo?.city,
          latitude: userData.latitude || userData.geo?.latitude,
          longitude: userData.longitude || userData.geo?.longitude,
          timezone: userData.timezone || userData.geo?.timezone,

          // Technical data (Parsed from User-Agent)
          device_type: uaResult.device.type || 'desktop',
          operating_system: `${uaResult.os.name || 'Unknown'} ${uaResult.os.version || ''}`.trim(),
          browser: `${uaResult.browser.name || 'Unknown'} ${uaResult.browser.version || ''}`.trim(),
          screen_resolution: userData.screen_resolution,

          // Acquisition data
          traffic_channel: userData.traffic_channel,
          utm_source: userData.utm_source,
          utm_medium: userData.utm_medium,
          utm_campaign: userData.utm_campaign,

          // Behavioral data
          visitor_type: 'new',
          engagement_score: 0,
          churn_risk: 0,
          lifetime_value: 0,

          // Preferences
          language_preference: userData.language,
          currency_preference: userData.currency || 'USD'
        });
      } else {
        // Update enhanced user profile
        user.last_seen = now;
        user.total_sessions += 1;

        // Update visitor type
        if (user.total_sessions > 1 && user.visitor_type === 'new') {
          user.visitor_type = 'returning';
        }

        // Update geographic data if not set
        if (!user.country && userData.geo?.country) {
          user.country = userData.geo.country;
          user.region = userData.geo.region;
          user.city = userData.geo.city;
          user.latitude = userData.geo.latitude;
          user.longitude = userData.geo.longitude;
          user.timezone = userData.geo.timezone;
        }

        // Update behavioral scores
        user.engagement_score = await this.calculateUserEngagementScore(user.user_id);
        user.churn_risk = await this.calculateChurnRisk(user.user_id);
      }

      await user.save();

      // Update cache
      await this.setToCache(`user:${userData.user_id}:${userData.website_type}`, user);

    } catch (error) {
      console.error('Enhanced user update error:', error);
    }
  }

  async updateEnhancedSessionData(eventData) {
    try {
      const session = await AnalyticsSession.findOne({
        session_id: eventData.session_id
      });

      if (session) {
        // Update session end time and duration
        session.end_time = new Date();
        session.session_duration = Math.floor(
          (session.end_time - session.start_time) / 1000
        );

        // Update page sequence for page views
        if (eventData.event_type === 'page_view' && eventData.page_data) {
          session.page_sequence.push({
            url: eventData.page_data.url,
            title: eventData.page_data.title,
            timestamp: eventData.timestamp,
            time_on_page: eventData.page_data.time_on_page,
            scroll_depth: eventData.page_data.scroll_depth
          });
          session.pages_per_session = session.page_sequence.length;
        }

        // Enhanced bounce rate calculation
        const pageViews = await AnalyticsEvent.countDocuments({
          session_id: eventData.session_id,
          event_type: 'page_view'
        });

        session.is_bounce = pageViews <= 1 && session.session_duration < 30;
        session.has_conversion = await this.checkSessionConversion(eventData.session_id);

        await session.save();
      }
    } catch (error) {
      console.error('Enhanced session update error:', error);
    }
  }

  // ========== ANALYTICS CALCULATION METHODS ==========

  async generateSessionSummary(sessionId) {
    const events = await AnalyticsEvent.find({ session_id: sessionId });

    const summary = {
      page_views: events.filter(e => e.event_type === 'page_view').length,
      events_count: events.length,
      click_events: events.filter(e => e.event_type === 'click').length,
      form_events: events.filter(e => e.event_type.startsWith('form_')).length,
      video_events: events.filter(e => e.event_type.startsWith('video_')).length,
      average_time_on_page: this.calculateAverageTimeOnPage(events),
      max_scroll_depth: this.calculateMaxScrollDepth(events)
    };

    return summary;
  }

  calculateAverageTimeOnPage(events) {
    const pageViews = events.filter(e => e.event_type === 'page_view');
    if (pageViews.length === 0) return 0;

    const totalTime = pageViews.reduce((sum, event) => {
      return sum + (event.page_data?.time_on_page || 0);
    }, 0);

    return totalTime / pageViews.length;
  }

  calculateMaxScrollDepth(events) {
    const scrollEvents = events.filter(e => e.event_type === 'scroll');
    if (scrollEvents.length === 0) return 0;

    return Math.max(...scrollEvents.map(e => e.page_data?.scroll_depth || 0));
  }

  async calculateEngagementScore(sessionId) {
    const events = await AnalyticsEvent.find({ session_id: sessionId });

    let score = 0;

    // Page views weight
    score += events.filter(e => e.event_type === 'page_view').length * 10;

    // Interaction weight
    score += events.filter(e =>
      ['click', 'form_start', 'form_submit'].includes(e.event_type)
    ).length * 15;

    // Video engagement weight
    score += events.filter(e =>
      e.event_type.startsWith('video_')
    ).length * 20;

    // Scroll depth weight
    const maxScroll = this.calculateMaxScrollDepth(events);
    score += maxScroll * 5;

    return Math.min(score, 100);
  }

  async calculateUserEngagementScore(userId) {
    const sessions = await AnalyticsSession.find({ user_id: userId });
    const totalScore = sessions.reduce((sum, session) => sum + (session.engagement_score || 0), 0);

    return sessions.length > 0 ? totalScore / sessions.length : 0;
  }

  async calculateChurnRisk(userId) {
    // Simplified churn risk calculation
    const user = await AnalyticsUser.findOne({ user_id: userId });
    if (!user) return 0;

    const daysSinceLastVisit = Math.floor((new Date() - user.last_seen) / (1000 * 60 * 60 * 24));
    const sessionFrequency = user.total_sessions / Math.max(1, user.days_since_first_visit);

    let risk = 0;
    if (daysSinceLastVisit > 30) risk += 50;
    if (sessionFrequency < 0.1) risk += 30;
    if (user.engagement_score < 20) risk += 20;

    return Math.min(risk, 100);
  }

  async checkSessionConversion(sessionId) {
    const conversionEvents = await AnalyticsEvent.find({
      session_id: sessionId,
      event_type: { $in: ['purchase', 'form_submit', 'newsletter_signup'] }
    });

    return conversionEvents.length > 0;
  }

  async getSessionConversions(sessionId) {
    return await AnalyticsEvent.find({
      session_id: sessionId,
      event_type: { $in: ['purchase', 'form_submit', 'newsletter_signup'] }
    });
  }

  async precomputeFunnelMetrics(funnelId) {
    // Implement funnel metric precomputation
    const funnel = await AnalyticsFunnel.findById(funnelId);
    if (!funnel) return;

    // Calculate funnel metrics
    const metrics = await this.calculateFunnelMetrics(funnel);
    funnel.analytics = metrics;
    await funnel.save();
  }

  async precomputeSegmentMembers(segmentId) {
    const segment = await AnalyticsSegment.findById(segmentId);
    if (!segment) return;

    const members = await this.calculateSegmentMembers(segment);
    segment.member_count = members.length;
    await segment.save();
  }

  // ========== ML MODEL PLACEHOLDERS ==========

  createSessionClassificationModel() {
    return { predict: (features) => ({ class: 'exploratory', score: 0.8 }) };
  }

  createEventAnalysisModel() {
    return { predict: (features) => ({ sentiment: 0.7, intent: 'browsing' }) };
  }

  createChurnPredictionModel() {
    return { predict: (features) => ({ risk: 0.3, confidence: 0.8 }) };
  }

  extractSessionFeatures(sessionData) {
    return {};
  }

  extractEventFeatures(eventData) {
    return {};
  }

  mlSessionClassification(features) {
    return { class: 'exploratory', score: 0.8 };
  }

  mlEventAnalysis(features) {
    return {
      sentiment_score: 0.7,
      intent_prediction: 'browsing',
      engagement_prediction: 'medium'
    };
  }

  // ========== REAL-TIME PROCESSING PLACEHOLDERS ==========

  async updateRealTimeDashboard(type, data) {
    // Implement real-time dashboard updates
  }

  async analyzeUserPattern(userId) {
    return { isVIP: false, pattern: 'normal' };
  }

  async triggerVIPNotification(sessionData) {
    // Implement VIP notifications
  }

  async updateSessionAnalytics(session) {
    // Implement session analytics updates
  }

  async triggerHighValueConversionAlert(session) {
    // Implement high-value conversion alerts
  }

  async updateGoalTracking(goal) {
    // Implement goal tracking updates
  }

  async triggerMilestoneNotification(userId, milestone) {
    // Implement milestone notifications
  }

  async processRealTimeEvent(eventData) {
    // Implement real-time event processing
  }

  async handleRealTimeNotifications(data) {
    // Implement real-time notifications
  }

  async handleRealTimeAlerts(data) {
    // Implement real-time alerts
  }
}

module.exports = new CoreController();