const mongoose = require('mongoose');

const aiDoctorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    diseaseName: { type: String, required: true },
    confidence: { type: Number, required: true },
    severity: { type: String, enum: ['Low', 'Moderate', 'High'], default: 'Moderate' },
    symptoms: { type: String },
    naturalCure: { type: String },
    detailedTreatment: { type: [String], default: [] },
    image: { type: String },
    crop: { type: String, default: 'General' },
    isResolved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AIDoctorDiagnosis', aiDoctorSchema);
