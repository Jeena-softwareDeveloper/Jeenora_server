const mongoose = require('mongoose');
const moment = require('moment');
const JobPost = require('../../models/hire/JobPostModel');
const Application = require('../../models/hire/applicationModel');
const HireProfile = require('../../models/hire/ProfileModel');

const employerController = {
    // Post Job (Employer specific)
    postJob: async (req, res) => {
        try {
            const jobData = req.body;
            // TODO: logic to create job linked to this employer
            res.status(201).json({
                success: true,
                message: "Job posted successfully",
                job: { id: "job_new_1", ...jobData }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Get Employer Jobs
    getMyJobs: async (req, res) => {
        try {
            // TODO: Fetch jobs posted by this employer
            res.status(200).json({
                success: true,
                jobs: []
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Shortlist Candidate
    shortlistCandidate: async (req, res) => {
        try {
            const { id: jobId } = req.params;
            const { candidateId } = req.body;
            // TODO: Update application status to shortlisted
            res.status(200).json({
                success: true,
                message: "Candidate shortlisted"
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // Analytics
    getAnalytics: async (req, res) => {
        try {
            const userId = req.id;

            // Check if user acts as an Employer (has active job posts or received applications)
            const hasPostedJobs = await JobPost.exists({ employerId: userId });
            const totalAppsReceived = await Application.countDocuments({ employerId: userId });

            const isEmployer = hasPostedJobs || totalAppsReceived > 0;

            // Common Profile Score
            const profile = await HireProfile.findOne({ user: userId });
            const profileScore = profile ? profile.completionPercentage : 0;

            const months = [];
            const appSeries = [];

            // Generate last 6 months labels
            for (let i = 5; i >= 0; i--) {
                months.push(moment().subtract(i, 'months').format('MMM'));
            }

            let responseData = {
                views: 0,
                applications: 0,
                hires: 0,
                profileScore,
                screening: 0,
                interviews: 0,
                offers: 0,
                activeJobs: 0,
                scheduledInterviews: 0
            };
            let recentActivities = [];
            let recentJobs = [];
            let chartData = {};

            if (isEmployer) {
                // --- EMPLOYER LOGIC ---
                const jobsSeries = [];
                responseData.views = 0;
                responseData.applications = totalAppsReceived;
                responseData.hires = await Application.countDocuments({ employerId: userId, currentStatus: 'offer_accepted' });

                // Chart Data Logic based on Time Frame
                const { timeFrame = 'month' } = req.query;
                let iterations = 6;
                let interval = 'months';
                let format = 'MMM';

                if (timeFrame === 'week') {
                    iterations = 7;
                    interval = 'days';
                    format = 'ddd'; // Mon, Tue...
                } else if (timeFrame === 'month') {
                    iterations = 30; // Last 30 days
                    interval = 'days';
                    format = 'DD MMM'; // 12 Dec
                } else if (timeFrame === 'quarter') {
                    iterations = 12; // About 12 weeks
                    interval = 'weeks';
                    format = 'W'; // Week number - simpler handling in logic
                } else if (timeFrame === 'year') {
                    iterations = 12;
                    interval = 'months';
                    format = 'MMM';
                }

                // Clear previous arrays to be safe
                months.length = 0;
                appSeries.length = 0;

                for (let i = iterations - 1; i >= 0; i--) {
                    const startDate = moment().subtract(i, interval).startOf(interval);
                    const endDate = moment().subtract(i, interval).endOf(interval);

                    // For 'quarter' (weeks), specific label formatting
                    let label;
                    if (timeFrame === 'quarter') {
                        label = `W${startDate.format('W')}`;
                    } else {
                        label = startDate.format(format);
                    }
                    months.push(label);

                    const appCount = await Application.countDocuments({
                        employerId: userId,
                        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                    });
                    appSeries.push(appCount);
                }
                // Recent Activities (Received Apps)
                const recentApps = await Application.find({ employerId: userId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .populate('jobId', 'title')
                    .lean();

                recentActivities = recentApps.map(app => ({
                    title: 'New Application',
                    message: `Received application for ${app.jobId?.title || 'a job'}`,
                    createdAt: app.createdAt
                }));

                // Recent Jobs (Active Postings)
                const recentJobsRaw = await JobPost.find({ employerId: userId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean();

                recentJobs = await Promise.all(recentJobsRaw.map(async (job) => {
                    const appCount = await Application.countDocuments({ jobId: job._id });
                    return {
                        _id: job._id,
                        title: job.title,
                        location: job.location,
                        department: job.skill, // Mapping skill to department for Dashboard display
                        applicationsCount: appCount,
                        status: job.status,
                        createdAt: job.createdAt
                    };
                }));

                // Pipeline Metrics
                responseData.screening = await Application.countDocuments({
                    employerId: userId,
                    currentStatus: { $in: ['viewed', 'shortlisted'] }
                });
                responseData.interviews = await Application.countDocuments({
                    employerId: userId,
                    currentStatus: { $in: ['interview_scheduled', 'interview_completed'] }
                });
                responseData.offers = await Application.countDocuments({
                    employerId: userId,
                    currentStatus: { $in: ['offer_extended', 'offer_accepted', 'offer_rejected'] }
                });

                responseData.activeJobs = await JobPost.countDocuments({
                    employerId: userId,
                    status: 'active'
                });

                responseData.scheduledInterviews = await Application.countDocuments({
                    employerId: userId,
                    "interviews.status": "scheduled",
                    "interviews.scheduledDate": { $gte: new Date() }
                });

                chartData = {
                    series: [
                        { name: "Applications Received", data: appSeries },
                        { name: "Jobs Posted", data: jobsSeries }
                    ],
                    categories: months
                };

            } else {
                // --- CANDIDATE LOGIC ---
                responseData.applications = await Application.countDocuments({ userId: userId });
                responseData.hires = await Application.countDocuments({ userId: userId, currentStatus: 'offer_accepted' });
                responseData.views = 0;

                // Chart Data Logic based on Time Frame (Candidate)
                const { timeFrame = 'month' } = req.query;
                let iterations = 6;
                let interval = 'months';
                let format = 'MMM';

                if (timeFrame === 'week') {
                    iterations = 7;
                    interval = 'days';
                    format = 'ddd';
                } else if (timeFrame === 'month') {
                    iterations = 30;
                    interval = 'days';
                    format = 'DD MMM';
                } else if (timeFrame === 'quarter') {
                    iterations = 12;
                    interval = 'weeks';
                    format = 'W';
                } else if (timeFrame === 'year') {
                    iterations = 12;
                    interval = 'months';
                    format = 'MMM';
                }

                // Clear previous arrays
                months.length = 0;
                appSeries.length = 0;

                for (let i = iterations - 1; i >= 0; i--) {
                    const startDate = moment().subtract(i, interval).startOf(interval);
                    const endDate = moment().subtract(i, interval).endOf(interval);

                    let label;
                    if (timeFrame === 'quarter') {
                        label = `W${startDate.format('W')}`;
                    } else {
                        label = startDate.format(format);
                    }
                    months.push(label);

                    const appCount = await Application.countDocuments({
                        userId: userId,
                        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
                    });
                    appSeries.push(appCount);
                }

                chartData = {
                    series: [
                        { name: "Applications Sent", data: appSeries }
                    ],
                    categories: months
                };

                // Recent Apps - Manual Population for robustness
                const recentApps = await Application.find({ userId: userId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean();

                // Fetch Titles (Handle both JobPost and Admin JobModel)
                const jobIds = recentApps.map(app => app.jobId);
                const sellerJobs = await JobPost.find({ _id: { $in: jobIds } }).select('title').lean();
                const AdminJob = require('../../models/hire/JobModel'); // Dynamic import for admin jobs
                const adminJobs = await AdminJob.find({ _id: { $in: jobIds } }).select('title').lean();

                const jobMap = {};
                sellerJobs.forEach(j => jobMap[j._id.toString()] = j.title);
                adminJobs.forEach(j => jobMap[j._id.toString()] = j.title);

                recentActivities = recentApps.map(app => {
                    const jobTitle = jobMap[app.jobId?.toString()] || 'Unknown Job';
                    return {
                        title: 'Application Sent',
                        message: `Applied to ${jobTitle}`,
                        createdAt: app.createdAt
                    };
                });

                // "Active Job Postings" for Candidate = "Recent Applied Jobs"
                recentJobs = recentApps.map(app => {
                    const jobTitle = jobMap[app.jobId?.toString()] || 'Unknown Job';
                    return {
                        _id: app.jobId,
                        title: jobTitle,
                        applicationsCount: 1,
                        status: app.currentStatus,
                        createdAt: app.createdAt // This is Application Date
                    };
                });

                chartData = {
                    series: [
                        { name: "Applications Sent", data: appSeries }
                    ],
                    categories: months
                };
            }

            // Calculate Trends 
            // Applications Trend (compare last 2 months from appSeries)
            let applicationsTrend = 0;
            if (appSeries.length >= 2) {
                const thisMonth = appSeries[appSeries.length - 1];
                const lastMonth = appSeries[appSeries.length - 2];
                if (lastMonth > 0) {
                    applicationsTrend = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
                } else if (thisMonth > 0) {
                    applicationsTrend = 100; // 0 to something is treated as 100% increase
                }
            }

            // Hires Trend (Current Month vs Last Month)
            const currentMonthStart = moment().startOf('month');
            const lastMonthStart = moment().subtract(1, 'months').startOf('month');
            const lastMonthEnd = moment().subtract(1, 'months').endOf('month');

            const thisMonthHires = await Application.countDocuments({
                employerId: userId,
                currentStatus: 'offer_accepted',
                updatedAt: { $gte: currentMonthStart.toDate() } // Using updatedAt for status change
            });

            const lastMonthHires = await Application.countDocuments({
                employerId: userId,
                currentStatus: 'offer_accepted',
                updatedAt: { $gte: lastMonthStart.toDate(), $lte: lastMonthEnd.toDate() }
            });

            let hiresTrend = 0;
            if (lastMonthHires > 0) {
                hiresTrend = Math.round(((thisMonthHires - lastMonthHires) / lastMonthHires) * 100);
            } else if (thisMonthHires > 0) {
                hiresTrend = 100;
            }

            // Attach trends to data
            responseData.applicationsTrend = applicationsTrend;
            responseData.hiresTrend = hiresTrend;

            res.status(200).json({
                success: true,
                data: responseData,
                recentActivities,
                recentJobs,
                chartData
            });

        } catch (error) {
            console.error('Analytics Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = employerController;
