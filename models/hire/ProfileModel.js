const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
    degree: String,
    field: String,
    institute: String,
    location: String,
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    grade: String
});

const experienceSchema = new mongoose.Schema({
    company: String,
    designation: String,
    employmentType: {
        type: String,
        enum: ['fulltime', 'parttime', 'contract', 'internship']
    },
    location: String,
    startDate: Date,
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    description: String,
    achievements: [String]
});

const projectSchema = new mongoose.Schema({
    title: String,
    description: String,
    role: String,
    technologies: [String],
    startDate: Date,
    endDate: Date,
    link: String
});

const certificationSchema = new mongoose.Schema({
    name: String,
    issuer: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String
});

const profileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HireUser',
        required: true,
        unique: true
    },
    personalDetails: {
        profilePicture: String,
        fullName: String,
        email: String,
        phone: String,
        dateOfBirth: Date,
        gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            pincode: String
        }
    },
    professionalSummary: {
        professionalHeadline: String,
        summary: String,
        currentRole: String,
        totalExperience: Number,
        currentCompany: String,
        industry: String,
        noticePeriod: String, // Changed to String to accommodate "Immediate" etc.
        availability: { type: String, enum: ['immediate', '15days', '30days', '3months'] }
    },
    careerPreferences: {
        preferredJobTitles: [String],
        preferredJobTypes: [{ type: String, enum: ['fulltime', 'parttime', 'contract', 'internship'] }],
        preferredLocations: [String],
        salaryExpectations: {
            currency: { type: String, default: 'INR' },
            minAnnual: Number,
            maxAnnual: Number,
            isNegotiable: { type: Boolean, default: false }
        },
        workMode: [{ type: String, enum: ['onsite', 'remote', 'hybrid'] }]
    },

    education: [educationSchema],
    workExperience: [experienceSchema],

    skills: {
        technical: [{ name: String, level: String, years: Number }],
        softSkills: [String],
        tools: [String],
        languages: [{ name: String, proficiency: String }]
    },

    certifications: [certificationSchema],
    projects: [projectSchema],

    completionPercentage: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('HireProfile', profileSchema);
