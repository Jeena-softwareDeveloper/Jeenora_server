const { responseReturn } = require("../../utiles/response")
const JobPost = require('../../models/hire/JobPostModel')
const AutoMatchLog = require('../../models/hire/autoMatchLogModel')
const HireUser = require('../../models/hire/hireUserModel')
const Application = require('../../models/hire/applicationModel')
const automatchService = require('./Services/autoMatchService')

class JobController {

    createJob = async (req, res) => {
        const { id, role } = req
        const {
            title,
            description,
            skill,
            location,
            experienceLevel,
            salaryRange,
            interviewDateTime,
            interviewVenue,
            autoMatchEnabled,
            maxCandidatesToPing
        } = req.body

        try {
            if (!title || !description || !skill || !location || !experienceLevel) {
                return responseReturn(res, 400, { error: 'Missing required fields' })
            }

            const jobData = {
                title,
                description,
                skill,
                location,
                experienceLevel,
                salaryRange,
                interviewDateTime: interviewDateTime ? new Date(interviewDateTime) : null,
                interviewVenue,
                autoMatchEnabled: autoMatchEnabled || false,
                maxCandidatesToPing: maxCandidatesToPing || 10,
                employerId: id,
                createdBy: role === 'admin' ? 'admin' : 'employer'
            }

            const job = await JobPost.create(jobData)

            if (autoMatchEnabled) {
                try {
                    const matchResult = await automatchService.runAutoMatch(job._id)
                    console.log('Auto-match triggered:', matchResult)
                } catch (matchError) {
                    console.error('Auto-match failed:', matchError)
                }
            }

            responseReturn(res, 201, {
                job,
                message: 'Job posted successfully'
            })

        } catch (error) {
            console.error('Create job error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getJob = async (req, res) => {
        const { id } = req.params

        try {
            const job = await JobPost.findById(id)
                .populate('employerId', 'name email phone')

            if (!job) {
                return responseReturn(res, 404, { error: 'Job not found' })
            }

            const matchStats = await AutoMatchLog.aggregate([
                { $match: { jobId: job._id } },
                {
                    $group: {
                        _id: '$response',
                        count: { $sum: 1 }
                    }
                }
            ])

            responseReturn(res, 200, {
                job,
                matchStats
            })

        } catch (error) {
            console.error('Get job error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    triggerAutoMatch = async (req, res) => {
        const { id } = req.params
        const { id: userId, role } = req

        try {
            const job = await JobPost.findById(id)

            if (!job) {
                return responseReturn(res, 404, { error: 'Job not found' })
            }

            if (role !== 'admin' && job.employerId.toString() !== userId.toString()) {
                return responseReturn(res, 403, { error: 'Access denied' })
            }

            const matchResult = await automatchService.runAutoMatch(id)

            responseReturn(res, 200, {
                message: 'Auto-match triggered successfully',
                ...matchResult
            })

        } catch (error) {
            console.error('Trigger auto-match error:', error)
            responseReturn(res, 500, { error: error.message || 'Internal Server Error' })
        }
    }

    getMatches = async (req, res) => {
        const { id } = req.params
        const { page = 1, parPage = 10, response } = req.query

        try {
            let skipPage = parseInt(parPage) * (parseInt(page) - 1)
            let query = { jobId: id }

            if (response && response !== 'all') {
                query.response = response
            }

            const matches = await AutoMatchLog.find(query)
                .populate('applicantId', 'name email phone skill location experience')
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ sentAt: -1 })

            const totalMatches = await AutoMatchLog.countDocuments(query)

            const stats = await AutoMatchLog.aggregate([
                { $match: { jobId: id } },
                {
                    $group: {
                        _id: '$response',
                        count: { $sum: 1 }
                    }
                }
            ])

            responseReturn(res, 200, {
                matches,
                totalMatches,
                stats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMatches / parPage),
                    totalItems: totalMatches
                }
            })

        } catch (error) {
            console.error('Get matches error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    closeJob = async (req, res) => {
        const { id } = req.params
        const { id: userId, role } = req

        try {
            const job = await JobPost.findById(id)

            if (!job) {
                return responseReturn(res, 404, { error: 'Job not found' })
            }

            if (role !== 'admin' && job.employerId.toString() !== userId.toString()) {
                return responseReturn(res, 403, { error: 'Access denied' })
            }

            const updatedJob = await JobPost.findByIdAndUpdate(
                id,
                { status: 'closed' },
                { new: true }
            )

            responseReturn(res, 200, {
                job: updatedJob,
                message: 'Job closed successfully'
            })

        } catch (error) {
            console.error('Close job error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    getEmployerJobs = async (req, res) => {
        const { id, role } = req
        const { page = 1, parPage = 10, status } = req.query

        try {
            let skipPage = parseInt(parPage) * (parseInt(page) - 1)
            let query = {}

            if (role !== 'admin') {
                query.employerId = id
            }

            if (status && status !== 'all') {
                query.status = status
            }

            const jobs = await JobPost.find(query)
                .populate('employerId', 'name email')
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ createdAt: -1 })

            const totalJobs = await JobPost.countDocuments(query)

            responseReturn(res, 200, {
                jobs,
                totalJobs,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalJobs / parPage),
                    totalItems: totalJobs
                }
            })

        } catch (error) {
            console.error('Get employer jobs error:', error)
            responseReturn(res, 500, { error: 'Internal Server Error' })
        }
    }

    // New Methods
    getFeed = async (req, res) => {
        try {
            const { page = 1, parPage = 10, search, location, experience } = req.query;
            let query = { status: 'active' };

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { skill: { $regex: search, $options: 'i' } }
                ];
            }
            if (location) {
                query.location = { $regex: location, $options: 'i' };
            }
            if (experience) {
                query.experienceLevel = { $regex: experience, $options: 'i' };
            }

            const jobs = await JobPost.find(query)
                .populate('employerId', 'name profileImageUrl')
                .skip((page - 1) * parPage)
                .limit(parseInt(parPage))
                .sort({ createdAt: -1 });

            const totalJobs = await JobPost.countDocuments(query);

            responseReturn(res, 200, {
                jobs,
                totalJobs,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalJobs / parPage)
                }
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    applyJob = async (req, res) => {
        try {
            const { id } = req.params;
            const { id: userId } = req;
            const { coverLetter } = req.body;

            // Try to find the job in JobPost (Seller) table first
            let job = await JobPost.findById(id);
            let jobType = 'seller';

            // If not found, try Job (Admin) table
            if (!job) {
                // Dynamic import or assume it's available or use mongoose.model
                const AdminJob = require('../../models/hire/JobModel');
                job = await AdminJob.findById(id);
                jobType = 'admin';
            }

            if (!job) return responseReturn(res, 404, { error: 'Job not found' });

            const existingApplication = await Application.findOne({ jobId: id, userId: userId }); // Updated applicantId -> userId
            if (existingApplication) {
                return responseReturn(res, 400, { error: 'You have already applied to this job' });
            }

            const user = await HireUser.findById(userId);
            if (!user.resumeUrl) {
                return responseReturn(res, 400, { error: 'Please upload a resume first' });
            }

            const employerId = job.employerId || job.postedBy;
            if (!employerId) {
                console.error("Apply Job Error: Employer ID missing on Job", job);
                return responseReturn(res, 500, { error: 'Job configuration error: Missing Employer ID' });
            }

            // Create Application
            await Application.create({
                jobId: id,
                userId: userId,
                employerId: employerId,
                coverLetter: coverLetter || '',
                resumeUrl: user.resumeUrl,
                currentStatus: 'applied',
                creditsUsed: 1, // Default credit usage
                resumeId: null // Explicitly null to prevent validation error
            });

            responseReturn(res, 201, { message: 'Applied successfully' });
        } catch (error) {
            console.error(error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    saveJob = async (req, res) => {
        try {
            const { id } = req.params;
            const { id: userId } = req;
            responseReturn(res, 200, { message: 'Job saved (Feature partially implemented)' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    unlockJob = async (req, res) => {
        try {
            const { id } = req.params;
            const { id: userId } = req;
            responseReturn(res, 200, { message: 'Job unlocked' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    getAppliedJobs = async (req, res) => {
        try {
            const { id: userId, role } = req
            const { page = 1, parPage = 10, status } = req.query

            // If admin/employer fetching applications they made? Rare. 
            // Or if this is for the 'seller/hire/applied-jobs' route, 
            // we might want to fetch applications made BY USERS for jobs posted BY THIS SELLER (Employer).
            // Based on "show users applied jobs", it implies "show me the users who applied to my jobs".

            // Re-reading request: "applied jobs inside show users applied jobs show" 
            // Context: "Hire > Applied Jobs" menu for Seller.
            // Seller = Employer/Recruiter usually.
            // If Seller is viewing "Applied Jobs", they likely want to see "Who applied to my jobs?" OR "Jobs I applied to?"
            // Given "Hire" context for Seller, it usually means "Manage Hiring".
            // "Users List" is nearby.
            // Let's assume this means "List all applications received for my jobs".

            // BUT, usually "Job Management" -> "Job Details" -> "Applications" handles this per job.
            // "Applied Jobs" usually means "My Applications" for a candidate.
            // However, the user said "applied jobs inside show users applied jobs".
            // This phrasing is tricky. "show users (who) applied (to) jobs".
            // That matches "All Applications for my posted jobs".

            if (role === 'admin' || role === 'employer' || role === 'seller') {
                console.log(`getAppliedJobs DEBUG: User: ${userId}, Role: ${role}, Status: ${status}`);
                let query = {}

                if (role !== 'admin' && role !== 'seller') {
                    // 1. Find IDs of jobs posted by this user (JobPost)
                    const myJobs = await JobPost.find({ employerId: userId }).select('_id');
                    let jobIds = myJobs.map(job => job._id);

                    console.log(`DEBUG: Found ${jobIds.length} JobPosts for employer ${userId}`);

                    // 3. Robust Query: Match applications that either:
                    //    a) Are linked to one of the found proper JobPosts (covers old apps without employerId)
                    //    b) Have the 'employerId' field set to this user (covers new apps, or apps on Admin jobs)
                    query.$or = [
                        { jobId: { $in: jobIds } },
                        { employerId: userId }
                    ];
                } else {
                    // Admin and Seller see all applications
                    query = {};
                }

                if (status && status !== 'all') {
                    // Application status mapping if needed, or direct match
                    query.currentStatus = status
                }

                console.log('DEBUG: Application Query:', JSON.stringify(query));

                // Manual populate strategy to handle both JobPost (Seller) and Job (Admin) models
                let apps = await Application.find(query)
                    .populate('userId', 'name email phone profileImageUrl resumeUrl') // Populate Applicant
                    .skip((parseInt(page) - 1) * parseInt(parPage))
                    .limit(parseInt(parPage))
                    .sort({ createdAt: -1 })
                    .lean();

                const jobIds = apps.map(app => app.jobId);

                // Fetch from JobPost
                const sellerJobs = await JobPost.find({ _id: { $in: jobIds } }).select('title').lean();

                // Fetch from Job (Admin)
                const AdminJob = require('../../models/hire/JobModel');
                const adminJobs = await AdminJob.find({ _id: { $in: jobIds } }).select('title').lean();

                // Merge
                const jobMap = {};
                sellerJobs.forEach(j => jobMap[j._id.toString()] = j);
                adminJobs.forEach(j => jobMap[j._id.toString()] = j);

                // Assign
                apps = apps.map(app => {
                    return {
                        ...app,
                        jobId: jobMap[app.jobId?.toString()] || { title: 'Unknown Job', _id: app.jobId }
                    }
                });

                console.log(`DEBUG: Found ${apps.length} applications with manual population.`);

                const total = await Application.countDocuments(query)

                responseReturn(res, 200, {
                    applications: apps,
                    total,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / parPage)
                    }
                })

            } else {
                // Format for a Candidate viewing their own applications
                console.log(`getAppliedJobs DEBUG: Candidate View. User: ${userId}`);
                let query = { userId: userId } // ApplicationModel uses userId for applicant

                if (status && status !== 'all') {
                    query.currentStatus = status
                }

                console.log('DEBUG: Candidate Query:', JSON.stringify(query));

                const applications = await Application.find(query)
                    .populate({
                        path: 'jobId',
                        select: 'title company location salary jobType status'
                    })
                    .skip((parseInt(page) - 1) * parseInt(parPage))
                    .limit(parseInt(parPage))
                    .sort({ createdAt: -1 })

                console.log(`DEBUG: Found ${applications.length} candidate applications.`);

                const total = await Application.countDocuments(query)

                responseReturn(res, 200, {
                    applications,
                    total,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / parPage)
                    }
                })
            }

        } catch (error) {
            console.error('Get applied jobs error:', error)
            responseReturn(res, 500, { error: error.message })
        }
    }
}

module.exports = new JobController()