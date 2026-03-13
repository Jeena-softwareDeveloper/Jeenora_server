const Prediction = require('../../models/analytics/Predection');
const User = require('../../models/analytics/User');

exports.createPrediction = async (req, res) => {
  try {
    const predictionData = {
      ...req.body,
      prediction_timestamp: new Date()
    };

    const prediction = await Prediction.findOneAndUpdate(
      { user_id: predictionData.user_id },
      predictionData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

exports.getUserPrediction = async (req, res) => {
  try {
    const prediction = await Prediction.findOne({ user_id: req.params.userId });
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: 'Prediction not found for this user'
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getHighRiskUsers = async (req, res) => {
  try {
    const { threshold = 0.7, page = 1, limit = 20 } = req.query;
    
    const highRiskUsers = await Prediction.find({
      predicted_churn: { $gte: parseFloat(threshold) }
    })
    .sort({ predicted_churn: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user_id', 'user_id first_seen_at last_seen_at location device');

    const total = await Prediction.countDocuments({
      predicted_churn: { $gte: parseFloat(threshold) }
    });

    res.json({
      success: true,
      data: highRiskUsers,
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

exports.getPredictionAnalytics = async (req, res) => {
  try {
    const [churnDistribution, avgPredictions, highRiskSegments] = await Promise.all([
      Prediction.aggregate([
        {
          $bucket: {
            groupBy: '$predicted_churn',
            boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1],
            default: 'other',
            output: {
              count: { $sum: 1 },
              avg_session_duration: { $avg: '$predicted_session_duration' }
            }
          }
        }
      ]),
      Prediction.aggregate([
        {
          $group: {
            _id: null,
            avg_churn_risk: { $avg: '$predicted_churn' },
            avg_predicted_session: { $avg: '$predicted_session_duration' },
            total_users: { $sum: 1 },
            high_risk_users: {
              $sum: { $cond: [{ $gte: ['$predicted_churn', 0.7] }, 1, 0] }
            }
          }
        }
      ]),
      Prediction.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: 'user_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $match: {
            predicted_churn: { $gte: 0.7 }
          }
        },
        {
          $group: {
            _id: '$user.device.device_type',
            count: { $sum: 1 },
            avg_churn_risk: { $avg: '$predicted_churn' }
          }
        }
      ])
    ]);

    const analytics = {
      churn_distribution: churnDistribution,
      overall_metrics: avgPredictions[0] || {},
      high_risk_segments: highRiskSegments,
      risk_categories: {
        low: churnDistribution.find(d => d._id === 0)?.count || 0,
        medium: (churnDistribution.find(d => d._id === 0.2)?.count || 0) +
                (churnDistribution.find(d => d._id === 0.4)?.count || 0),
        high: (churnDistribution.find(d => d._id === 0.6)?.count || 0) +
              (churnDistribution.find(d => d._id === 0.8)?.count || 0)
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

exports.bulkUpdatePredictions = async (req, res) => {
  try {
    const { predictions, model_version } = req.body;
    
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Predictions array is required'
      });
    }

    const bulkOperations = predictions.map(prediction => ({
      updateOne: {
        filter: { user_id: prediction.user_id },
        update: {
          ...prediction,
          model_version: model_version || 'v1.0',
          prediction_timestamp: new Date()
        },
        upsert: true
      }
    }));

    const result = await Prediction.bulkWrite(bulkOperations);

    res.json({
      success: true,
      data: {
        processed: result.modifiedCount + result.upsertedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};