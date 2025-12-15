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

            const job = await JobPost.findById(id);
            if (!job) return responseReturn(res, 404, { error: 'Job not found' });

            const existingApplication = await Application.findOne({ jobId: id, applicantId: userId });
            if (existingApplication) {
                return responseReturn(res, 400, { error: 'You have already applied to this job' });
            }

            const user = await HireUser.findById(userId);
            if (!user.resumeUrl) {
                return responseReturn(res, 400, { error: 'Please upload a resume first' });
            }

            // Create Application
            await Application.create({
                jobId: id,
                applicantId: userId,
                employerId: job.employerId,
                coverLetter: coverLetter || '',
                resumeUrl: user.resumeUrl,
                status: 'pending'
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
}

module.exports = new JobController()