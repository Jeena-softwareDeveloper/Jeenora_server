const express = require('express');
const router = express.Router();
const coreController = require('../../controllers/analytics/coreController');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

// Add validation result middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Rate limiting (your existing config is good)
const standardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const batchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many batch requests, please try again later.' }
});

const realTimeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: { error: 'Too many real-time requests, please try again later.' }
});

// Enhanced Validation middleware
const validateSessionStart = [
  body('user_id').notEmpty().withMessage('user_id is required'),
  body('session_id').optional().isString().isLength({ min: 1 }),
  body('anonymous_id').optional().isString().isLength({ min: 1 }),
  body('start_time').optional().isISO8601(),
  body('device_type').optional().isIn(['desktop', 'mobile', 'tablet']),
  body('traffic_channel').optional().isIn([
    'organic_search', 'paid_search', 'direct', 'social_media', 
    'email', 'referral', 'affiliate', 'display'
  ]),
  handleValidationErrors
];

const validateEventCapture = [
  body('user_id').notEmpty().withMessage('user_id is required'),
  body('session_id').notEmpty().withMessage('session_id is required'),
  body('event_type').notEmpty().isIn([
    'page_view', 'click', 'form_start', 'form_submit', 'scroll',
    'video_play', 'video_pause', 'video_complete', 'purchase',
    'newsletter_signup', 'download', 'custom'
  ]).withMessage('Valid event_type is required'),
  body('event_name').notEmpty().withMessage('event_name is required'),
  body('timestamp').optional().isISO8601(),
  body('page_data.url').optional().isURL(),
  handleValidationErrors
];

const validateBatchEvents = [
  body('events').isArray({ min: 1, max: 1000 }).withMessage('Events must be an array with 1-1000 items'),
  body('events.*.user_id').notEmpty().withMessage('Each event must have a user_id'),
  body('events.*.session_id').notEmpty().withMessage('Each event must have a session_id'),
  body('events.*.event_type').notEmpty().withMessage('Each event must have an event_type'),
  body('events.*.event_name').notEmpty().withMessage('Each event must have an event_name'),
  handleValidationErrors
];

const validateFunnelCreation = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Funnel name is required (1-100 chars)'),
  body('steps').isArray({ min: 2, max: 10 }).withMessage('Funnel must have 2-10 steps'),
  body('steps.*.name').notEmpty().trim().isLength({ min: 1 }).withMessage('Each step must have a name'),
  body('steps.*.event_type').notEmpty().withMessage('Each step must have an event_type'),
  body('steps.*.event_name').notEmpty().withMessage('Each step must have an event_name'),
  handleValidationErrors
];

const validateSegmentCreation = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Segment name is required (1-100 chars)'),
  body('rules').isArray({ min: 1, max: 20 }).withMessage('Segment must have 1-20 rules'),
  body('rules.*.field').notEmpty().withMessage('Each rule must have a field'),
  body('rules.*.operator').notEmpty().isIn(['equals', 'contains', 'greater_than', 'less_than', 'exists']).withMessage('Valid operator is required'),
  body('rules.*.value').optional(), // Value can be optional for 'exists' operator
  handleValidationErrors
];

const validateGoalTracking = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Goal name is required'),
  body('user_id').notEmpty().withMessage('user_id is required'),
  body('session_id').notEmpty().withMessage('session_id is required'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('funnel_id').optional().isMongoId().withMessage('Valid funnel ID is required'),
  body('funnel_step').optional().isInt({ min: 1 }).withMessage('Funnel step must be a positive integer'),
  handleValidationErrors
];

// Parameter validation
const validateMongoId = [
  param('id').isMongoId().withMessage('Valid ID is required'),
  handleValidationErrors
];

const validateSessionId = [
  param('sessionId').isString().isLength({ min: 1 }).withMessage('Valid session ID is required'),
  handleValidationErrors
];

const validateUserId = [
  param('userId').isString().isLength({ min: 1 }).withMessage('Valid user ID is required'),
  handleValidationErrors
];

const validateFunnelId = [
  param('funnelId').isMongoId().withMessage('Valid funnel ID is required'),
  handleValidationErrors
];

const validateSegmentId = [
  param('segmentId').isMongoId().withMessage('Valid segment ID is required'),
  handleValidationErrors
];

// Query parameter validation
const validateAnalyticsQuery = [
  query('website_type').optional().isString().trim(),
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format'),
  query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Valid timeframe required'),
  handleValidationErrors
];

// ========== CORRECTED ROUTES ==========

// Session management
router.post('/sessions/start', standardLimiter, validateSessionStart, coreController.startSession);
router.put('/sessions/:sessionId/end', standardLimiter, validateSessionId, coreController.endSession);

// Event tracking
router.post('/events', realTimeLimiter, validateEventCapture, coreController.captureEvent);
router.post('/events/batch', batchLimiter, validateBatchEvents, coreController.captureBatchEvents);

// Funnel analysis
router.post('/funnels', standardLimiter, validateFunnelCreation, coreController.createFunnel);
router.get('/funnels/:funnelId/analytics', standardLimiter, validateFunnelId, validateAnalyticsQuery, coreController.getFunnelAnalytics);

// User segmentation
router.post('/segments', standardLimiter, validateSegmentCreation, coreController.createSegment);
router.get('/segments/:segmentId/users', standardLimiter, validateSegmentId, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1-500'),
  handleValidationErrors
], coreController.getSegmentUsers);

// Goal tracking - FIXED ROUTE NAMES
router.post('/goals', standardLimiter, validateGoalTracking, coreController.trackGoal);
router.get('/users/:userId/goals', standardLimiter, validateUserId, validateAnalyticsQuery, coreController.getUserGoals);

// Advanced analytics - FIXED ROUTE NAMES
router.get('/users/:userId/engagement', standardLimiter, validateUserId, validateAnalyticsQuery, coreController.getUserEngagement);
router.get('/analytics/cohorts', standardLimiter, validateAnalyticsQuery, coreController.getCohortAnalysis);
router.get('/analytics/paths', standardLimiter, [
  query('start_page').optional().isString(),
  query('end_page').optional().isString(),
  query('max_path_length').optional().isInt({ min: 1, max: 20 }),
  query('website_type').optional().isString(),
  handleValidationErrors
], coreController.getPathAnalysis);

// Real-time analytics
router.get('/realtime/active-users', standardLimiter, [
  query('website_type').optional().isString(),
  query('time_window').optional().isIn(['5m', '15m', '1h', '24h']).withMessage('Valid time window required'),
  handleValidationErrors
], coreController.getActiveUsers);

router.get('/realtime/conversions', standardLimiter, [
  query('website_type').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1-200'),
  handleValidationErrors
], coreController.getConversionFeed);

// Data export
router.post('/export/events', batchLimiter, [
  body('filters').optional().isObject(),
  body('fields').optional().isArray(),
  body('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  handleValidationErrors
], coreController.exportEvents);

// Health and monitoring
router.get('/health', coreController.healthCheck);
router.get('/metrics', coreController.getSystemMetrics);

// ========== ADD MISSING ROUTES ==========

// User-specific routes
router.get('/users/:userId/sessions', standardLimiter, validateUserId, validateAnalyticsQuery, coreController.getUserSessions);

// Session-specific routes  
router.get('/sessions/:sessionId/events', standardLimiter, validateSessionId, [
  query('event_type').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  handleValidationErrors
], coreController.getSessionEvents);

// Funnel management
router.get('/funnels', standardLimiter, validateAnalyticsQuery, coreController.getFunnels);
router.delete('/funnels/:funnelId', standardLimiter, validateFunnelId, coreController.deleteFunnel);

// Segment management
router.get('/segments', standardLimiter, validateAnalyticsQuery, coreController.getSegments);
router.delete('/segments/:segmentId', standardLimiter, validateSegmentId, coreController.deleteSegment);

module.exports = router;