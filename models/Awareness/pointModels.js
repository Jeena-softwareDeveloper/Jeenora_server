const mongoose = require('mongoose')

const pointsSchema = new mongoose.Schema({
    guides: { type: Number, default: 0 },
    members: { type: Number, default: 0 },
    farmersHelped: { type: Number, default: 0 },
    expertAdvisors: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    localFarmersSupport: { type: Number, default: 0 },
    localCommunity: { type: Number, default: 0 },
    localSources: { type: Number, default: 0 }
}, { timestamps: true })

module.exports = mongoose.model('AwarenessPoints', pointsSchema)
