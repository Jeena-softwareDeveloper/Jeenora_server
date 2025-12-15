const Funnel = require('../../models/analytics/Funnel');
const Event = require('../../models/analytics/Event');

exports.createFunnel = async (req, res) => {
  try {
    const funnelData = {
      ...req.body,
      funnel_id: req.body.funnel_id || `funnel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const funnel = new Funnel(funnelData);
    await funnel.save();

    res.status(201).json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getFunnel = async (req, res) => {
  try {
    const funnel = await Funnel.findOne({ funnel_id: req.params.funnelId });
    
    if (!funnel) {
      return res.status(404).json({
        success: false,
        error: 'Funnel not found'
      });
    }

    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.updateFunnel = async (req, res) => {
  try {
    const funnel = await Funnel.findOneAndUpdate(
      { funnel_id: req.params.funnelId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!funnel) {
      return res.status(404).json({
        success: false,
        error: 'Funnel not found'
      });
    }

    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.addEventToFunnel = async (req, res) => {
  try {
    const { event_type, timestamp, event_id, metadata } = req.body;
    
    const funnel = await Funnel.findOne({ funnel_id: req.params.funnelId });
    
    if (!funnel) {
      return res.status(404).json({
        success: false,
        error: 'Funnel not found'
      });
    }

    funnel.events_tracked.push({
      event_type,
      timestamp: timestamp || new Date(),
      event_id,
      metadata
    });

    await funnel.save();

    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.markFunnelConversion = async (req, res) => {
  try {
    const { conversion_value } = req.body;
    
    const funnel = await Funnel.findOneAndUpdate(
      { funnel_id: req.params.funnelId },
      {
        conversion: true,
        conversion_value: conversion_value || 0,
        completed_at: new Date()
      },
      { new: true }
    );

    if (!funnel) {
      return res.status(404).json({
        success: false,
        error: 'Funnel not found'
      });
    }

    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getFunnelAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter = {};
    if (start_date && end_date) {
      dateFilter.start_time = {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      };
    }

    const [funnelStats, conversionRate, dropoffPoints] = await Promise.all([
      Funnel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            total_funnels: { $sum: 1 },
            completed_funnels: {
              $sum: { $cond: ['$conversion', 1, 0] }
            },
            total_conversion_value: { $sum: '$conversion_value' },
            avg_events_per_funnel: { $avg: { $size: '$events_tracked' } }
          }
        }
      ]),
      Funnel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$start_time'
              }
            },
            total: { $sum: 1 },
            conversions: {
              $sum: { $cond: ['$conversion', 1, 0] }
            }
          }
        },
        {
          $project: {
            date: '$_id',
            conversion_rate: {
              $multiply: [
                { $divide: ['$conversions', '$total'] },
                100
              ]
            },
            total: 1,
            conversions: 1
          }
        },
        { $sort: { date: 1 } }
      ]),
      Funnel.aggregate([
        { $match: dateFilter },
        { $unwind: '$events_tracked' },
        {
          $group: {
            _id: '$events_tracked.event_type',
            count: { $sum: 1 },
            unique_users: { $addToSet: '$user_id' }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    const analytics = {
      overview: funnelStats[0] || {
        total_funnels: 0,
        completed_funnels: 0,
        total_conversion_value: 0,
        avg_events_per_funnel: 0
      },
      conversion_trends: conversionRate,
      event_engagement: dropoffPoints,
      overall_conversion_rate: funnelStats[0] ? 
        (funnelStats[0].completed_funnels / funnelStats[0].total_funnels) * 100 : 0
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

exports.getUserFunnels = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const funnels = await Funnel.find({ user_id: req.params.userId })
      .sort({ start_time: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Funnel.countDocuments({ user_id: req.params.userId });

    res.json({
      success: true,
      data: funnels,
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