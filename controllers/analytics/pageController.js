
const Page = require('../../models/analytics/Pages');
const Event = require('../../models/analytics/Event');

exports.getPage = async (req, res) => {
  try {
    const page = await Page.findOne({ page_url: req.params.pageUrl });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'Page not found'
      });
    }

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const page = await Page.findOneAndUpdate(
      { page_url: req.params.pageUrl },
      req.body,
      { new: true, runValidators: true }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'Page not found'
      });
    }

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getPageAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const pageUrl = req.params.pageUrl;

    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.timestamp = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const [page, eventStats, timelineStats, userDemographics] = await Promise.all([
      Page.findOne({ page_url: pageUrl }),
      Event.aggregate([
        {
          $match: {
            'metadata.page_url': pageUrl,
            ...dateFilter
          }
        },
        {
          $group: {
            _id: '$event_type',
            count: { $sum: 1 },
            avg_duration: { $avg: '$duration' }
          }
        }
      ]),
      Event.aggregate([
        {
          $match: {
            'metadata.page_url': pageUrl,
            ...dateFilter
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamp'
              }
            },
            views: { $sum: 1 },
            unique_users: { $addToSet: '$user_id' },
            avg_duration: { $avg: '$duration' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Event.aggregate([
        {
          $match: {
            'metadata.page_url': pageUrl,
            event_type: 'page_view',
            ...dateFilter
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: 'user_id',
            as: 'user'
          }
        },
        {
          $group: {
            _id: null,
            countries: { $addToSet: '$user.location.country' },
            devices: { $addToSet: '$user.device.device_type' },
            browsers: { $addToSet: '$user.device.browser' }
          }
        }
      ])
    ]);

    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'Page not found'
      });
    }

    const analytics = {
      page,
      event_summary: eventStats.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          avg_duration: curr.avg_duration
        };
        return acc;
      }, {}),
      timeline: timelineStats,
      demographics: userDemographics[0] || {}
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

exports.getPopularPages = async (req, res) => {
  try {
    const { metric = 'total_views', limit = 10, start_date, end_date } = req.query;
    
    let sortCriteria = {};
    sortCriteria[metric] = -1;

    const pages = await Page.find()
      .sort(sortCriteria)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: pages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.searchPages = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    
    const searchFilter = query ? {
      $or: [
        { page_url: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    } : {};

    const pages = await Page.find(searchFilter)
      .sort({ total_views: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Page.countDocuments(searchFilter);

    res.json({
      success: true,
      data: pages,
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

exports.updatePageEngagementTrend = async (req, res) => {
  try {
    const { date, views, unique_visitors, avg_duration, bounce_rate } = req.body;
    
    const page = await Page.findOne({ page_url: req.params.pageUrl });
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: 'Page not found'
      });
    }

    const trendDate = new Date(date);
    const existingTrendIndex = page.engagement_trend.findIndex(
      trend => trend.date.toDateString() === trendDate.toDateString()
    );

    if (existingTrendIndex !== -1) {
      page.engagement_trend[existingTrendIndex] = {
        date: trendDate,
        views: views || page.engagement_trend[existingTrendIndex].views,
        unique_visitors: unique_visitors || page.engagement_trend[existingTrendIndex].unique_visitors,
        avg_duration: avg_duration || page.engagement_trend[existingTrendIndex].avg_duration,
        bounce_rate: bounce_rate || page.engagement_trend[existingTrendIndex].bounce_rate
      };
    } else {
      page.engagement_trend.push({
        date: trendDate,
        views: views || 0,
        unique_visitors: unique_visitors || 0,
        avg_duration: avg_duration || 0,
        bounce_rate: bounce_rate || 0
      });
    }

    await page.save();

    res.json({
      success: true,
      data: page
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};