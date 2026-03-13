const Application = require('../../models/hire/applicationModel');
const Job = require('../../models/hire/JobModel');
const JobPost = require('../../models/hire/JobPostModel');
const HireUser = require('../../models/hire/hireUserModel');
const CreditSetting = require('../../models/hire/creditSettingModel');
const { responseReturn } = require("../../utiles/response");

class ApplicationController {

    applyForJob = async (req, res) => {
        try {
            const { jobId, resumeId, coverLetter, answers } = req.body;
            const { id: userId } = req;

            // 1. Find Job (Seller or Admin)
            let job = await JobPost.findById(jobId);
            if (!job) {
                job = await Job.findById(jobId);
            }

            if (!job || job.status !== 'active') {
                return responseReturn(res, 404, { error: "Job not found or no longer active" });
            }

            const employerId = job.employerId || job.postedBy;
            if (!employerId) {
                return responseReturn(res, 500, { error: "Job configuration error: Missing Employer ID" });
            }

            // 2. Check User User
            const user = await HireUser.findById(userId);
            if (!user) {
                return responseReturn(res, 404, { error: "User not found" });
            }

            // Determine credits required
            const settings = await CreditSetting.getSettings();
            const globalCost = settings.jobApplyCost || 5;
            const required = (job.application && job.application.creditsRequired) !== undefined
                ? job.application.creditsRequired
                : globalCost;

            if (user.creditBalance < required) {
                return responseReturn(res, 403, {
                    error: "Insufficient credits",
                    required: required,
                    available: user.creditBalance
                });
            }

            // 3. Check for Duplicate Application
            const existingApp = await Application.findOne({ userId, jobId });
            if (existingApp) {
                return responseReturn(res, 400, { error: "You have already applied for this job" });
            }

            // 5. Deduct Credits
            user.creditBalance -= required;
            await user.save();

            // Sanitize resumeId (handle 'primary' string or invalid ID)
            let finalResumeId = null;
            if (resumeId && /^[0-9a-fA-F]{24}$/.test(resumeId)) {
                finalResumeId = resumeId;
            }

            // 6. Create Application
            const application = await Application.create({
                userId,
                jobId,
                employerId: employerId,
                resumeId: finalResumeId,
                resumeUrl: user.resumeUrl,
                coverLetter,
                answers,
                creditsUsed: required,
                currentStatus: 'applied',
                statusHistory: [{
                    status: 'applied',
                    date: new Date(),
                    note: 'Application submitted successfully'
                }]
            });

            // 7. Update Job Stats
            await Job.findByIdAndUpdate(jobId, { $inc: { 'stats.totalApplications': 1 } });

            // 8. Respond
            responseReturn(res, 201, {
                message: "Application submitted successfully",
                applicationId: application._id,
                remainingCredits: user.creditBalance
            });

        } catch (error) {
            console.error("Application Error:", error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getUserApplications = async (req, res) => {
        try {
            const { id: userId } = req;
            const { status, dateFrom, dateTo, company, location, jobType, sort } = req.query;

            // Base Query
            let query = { userId };

            // Filters
            if (status && status !== 'All') {
                if (status === 'Active') {
                    query.currentStatus = { $in: ['applied', 'viewed', 'shortlisted', 'interview_scheduled', 'interview_completed', 'offer_extended'] };
                } else if (status === 'Interview') {
                    query.currentStatus = { $in: ['interview_scheduled', 'interview_completed'] };
                } else {
                    query.currentStatus = status.toLowerCase();
                }
            }

            if (dateFrom || dateTo) {
                query.createdAt = {};
                if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
                if (dateTo) query.createdAt.$lte = new Date(dateTo);
            }

            let sortOption = { createdAt: -1 };
            if (sort === 'oldest') sortOption = { createdAt: 1 };

            // Fetch applications without populate initially
            const applications = await Application.find(query).sort(sortOption).lean();

            // Extract Job IDs
            const jobIds = applications.map(app => app.jobId);

            // Fetch Jobs from both collections
            // JobPost: Populate employerId
            const jobPosts = await JobPost.find({ _id: { $in: jobIds } })
                .select('title employerId location salaryRange status slug')
                .populate('employerId', 'name profileImageUrl')
                .lean();

            // Admin Job: Specific fields
            const adminJobs = await Job.find({ _id: { $in: jobIds } })
                .select('title company location jobType salary status slug')
                .lean();

            // Create Job Map
            const jobMap = {};
            jobPosts.forEach(job => { jobMap[job._id.toString()] = job; });
            adminJobs.forEach(job => { jobMap[job._id.toString()] = job; });

            // Attach Job Details & Normalize
            const populatedApps = applications.map(app => {
                let jobData = jobMap[app.jobId?.toString()];

                if (!jobData) {
                    jobData = {
                        title: 'Unknown Job',
                        company: { name: 'Unknown Company', logo: '' },
                        location: { city: 'N/A' },
                        jobType: 'N/A',
                        salary: {},
                        status: 'expired'
                    };
                } else if (jobData.salaryRange) {
                    // It's a JobPost (has salaryRange usually, or check absence of company.name object)
                    // JobPost normalization
                    const employer = jobData.employerId || {};
                    const locParams = jobData.location ? { city: jobData.location } : { city: 'Remote' }; // JobPost location string

                    jobData = {
                        _id: jobData._id,
                        title: jobData.title,
                        company: {
                            name: employer.name || 'Hiring Company',
                            logo: employer.profileImageUrl || ''
                        },
                        location: locParams,
                        jobType: 'Full-Time', // Default for JobPost
                        salary: {
                            min: jobData.salaryRange?.min,
                            max: jobData.salaryRange?.max,
                            currency: 'USD' // Default
                        },
                        status: jobData.status,
                        slug: jobData.slug
                    };
                }
                // If it's Admin Job, it already has correct structure (company.name, location.city, etc)

                return { ...app, jobId: jobData };
            });

            // Apply Filters on Populated Fields
            let filteredApps = populatedApps;

            if (company) {
                filteredApps = filteredApps.filter(app => app.jobId?.company?.name?.toLowerCase().includes(company.toLowerCase()));
            }
            if (location) {
                filteredApps = filteredApps.filter(app => {
                    const loc = app.jobId?.location;
                    if (!loc) return false;
                    if (location.toLowerCase() === 'remote') return loc.isRemote || (loc.city && loc.city.toLowerCase() === 'remote');
                    if (location.toLowerCase() === 'on-site') return !loc.isRemote;
                    return loc.city?.toLowerCase().includes(location.toLowerCase());
                });
            }
            if (jobType) {
                filteredApps = filteredApps.filter(app => app.jobId?.jobType === jobType);
            }

            responseReturn(res, 200, { applications: filteredApps });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getApplicationStats = async (req, res) => {
        try {
            const { id: userId } = req;
            const applications = await Application.find({ userId });

            const stats = {
                total: applications.length,
                viewed: 0,
                shortlisted: 0,
                interview: 0,
                offer: 0,
                rejected: 0,
                successScore: 72 // Mock or calculated
            };

            const activeStatuses = ['applied', 'viewed', 'shortlisted', 'interview_scheduled', 'interview_completed', 'offer_extended'];

            applications.forEach(app => {
                if (app.currentStatus === 'viewed') stats.viewed++;
                if (app.currentStatus === 'shortlisted') stats.shortlisted++;
                if (['interview_scheduled', 'interview_completed'].includes(app.currentStatus)) stats.interview++;
                if (['offer_extended', 'offer_accepted'].includes(app.currentStatus)) stats.offer++;
                if (app.currentStatus === 'rejected') stats.rejected++;
            });

            // Rates
            stats.interviewRate = stats.total > 0 ? ((stats.interview / stats.total) * 100).toFixed(0) : 0;
            stats.offerRate = stats.total > 0 ? ((stats.offer / stats.total) * 100).toFixed(0) : 0;

            responseReturn(res, 200, { stats });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    updateNote = async (req, res) => {
        try {
            const { id } = req.params;
            const { note } = req.body;
            const app = await Application.findById(id);
            if (!app) return responseReturn(res, 404, { error: 'Application not found' });

            app.userNotes.push({ note, createdAt: new Date() });
            await app.save();
            responseReturn(res, 200, { message: 'Note added', note: app.userNotes[app.userNotes.length - 1] });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    withdrawApplication = async (req, res) => {
        try {
            const { id } = req.params;
            const app = await Application.findById(id);
            if (!app) return responseReturn(res, 404, { error: 'Application not found' });

            if (['rejected', 'withdrawn', 'offer_accepted'].includes(app.currentStatus)) {
                return responseReturn(res, 400, { error: 'Cannot withdraw application in current status' });
            }

            app.currentStatus = 'withdrawn';
            app.statusHistory.push({
                status: 'withdrawn',
                date: new Date(),
                triggeredBy: 'user',
                notes: 'User withdrew application'
            });
            await app.save();
            responseReturn(res, 200, { message: 'Application withdrawn successfully', status: 'withdrawn' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    enableChat = async (req, res) => {
        try {
            const { id: applicationId } = req.params;
            const { id: userId } = req;

            const application = await Application.findById(applicationId);
            if (!application) return responseReturn(res, 404, { error: 'Application not found' });

            if (application.chatEnabled) {
                return responseReturn(res, 400, { error: 'Chat is already enabled for this application' });
            }

            const user = await HireUser.findById(userId);
            if (!user) return responseReturn(res, 404, { error: 'User not found' });

            const settings = await CreditSetting.getSettings();
            const cost = settings.chatEnableCost || 10;

            if (user.creditBalance < cost) {
                return responseReturn(res, 403, {
                    error: 'Insufficient credits',
                    required: cost,
                    available: user.creditBalance
                });
            }

            // Deduct credits and enable chat
            user.creditBalance -= cost;
            application.chatEnabled = true;

            await user.save();
            await application.save();

            responseReturn(res, 200, {
                message: 'Chat enabled successfully',
                remainingCredits: user.creditBalance
            });
        } catch (error) {
            console.error('Enable chat error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new ApplicationController();
