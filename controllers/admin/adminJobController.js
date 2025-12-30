const Job = require('../../models/hire/JobModel');
const Application = require('../../models/hire/applicationModel');
const { responseReturn } = require("../../utiles/response");
const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');

class AdminJobController {
    // ... existing ...

    // Get applications for a specific job
    getJobApplications = async (req, res) => {
        try {
            const { id } = req.params;
            const applications = await Application.find({ jobId: id })
                .populate('userId', 'name email image')
                .sort({ createdAt: -1 });

            // Simple stats (mocking views for now as we don't track them yet)
            const stats = {
                totalViews: Math.floor(Math.random() * 1000) + applications.length * 5, // Mock views > applications
            };

            responseReturn(res, 200, { applications, stats });
        } catch (error) {
            console.error('Get Job Applications Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    createJob = async (req, res) => {
        const form = formidable({ multiples: false, keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 500, { error: 'File parsing error' });
            }

            try {
                let {
                    title, company, description, requirements, location,
                    jobType, salary, application, status
                } = fields;

                // Parse strings back to objects if they are strings
                // (Frontend will send them as JSON strings via FormData)
                if (typeof company === 'string') company = JSON.parse(company);
                if (typeof location === 'string') location = JSON.parse(location);
                if (typeof requirements === 'string') requirements = JSON.parse(requirements);
                if (typeof salary === 'string') salary = JSON.parse(salary);
                if (typeof application === 'string') application = JSON.parse(application);

                // Handle Logo Upload
                const { logo } = files;
                if (logo && logo.filepath) {
                    const result = await cloudinary.uploader.upload(logo.filepath, {
                        folder: 'Hire Jobs',
                        resource_type: 'auto'
                    });
                    company.logo = result.secure_url;
                } else {
                    company.logo = ""; // Explicitly set empty if not provided
                }

                const job = await Job.create({
                    title,
                    company,
                    description,
                    requirements,
                    location,
                    jobType,
                    salary,
                    application,
                    status,
                    postedBy: req.id
                });

                responseReturn(res, 201, { message: 'Job created successfully', job });
            } catch (error) {
                console.error('Create Job Error:', error);
                responseReturn(res, 500, { error: error.message });
            }
        });
    }

    getJobs = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                startDate,
                endDate,
                credits, // Range logic handled here or frontend?? Let's handle string ranges like '1-3'
                applications // '0', '1-10', etc.
            } = req.query;

            const query = {};

            // Status Filter
            if (status && status !== 'All') {
                query.status = status.toLowerCase();
            }

            // Date Range
            if (startDate && endDate) {
                query.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            // Credits Filter
            if (credits && credits !== 'All') {
                if (credits === '7+') {
                    query['application.creditsRequired'] = { $gte: 7 };
                } else {
                    const [min, max] = credits.split('-');
                    if (min && max) {
                        query['application.creditsRequired'] = { $gte: Number(min), $lte: Number(max) };
                    }
                }
            }

            // Applications Filter
            if (applications && applications !== 'All') {
                if (applications === '0') {
                    query['stats.totalApplications'] = 0;
                } else if (applications === '51+') {
                    query['stats.totalApplications'] = { $gte: 51 };
                } else {
                    const [min, max] = applications.split('-');
                    if (min && max) {
                        query['stats.totalApplications'] = { $gte: Number(min), $lte: Number(max) };
                    }
                }
            }

            const jobs = await Job.find(query)
                .sort({ createdAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit));

            const total = await Job.countDocuments(query);

            responseReturn(res, 200, { jobs, total });

        } catch (error) {
            console.error('Get Jobs Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getJobById = async (req, res) => {
        try {
            const { id } = req.params;
            const job = await Job.findById(id);
            if (!job) return responseReturn(res, 404, { error: 'Job not found' });
            responseReturn(res, 200, { job });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    updateJob = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const job = await Job.findByIdAndUpdate(id, updateData, { new: true });

            if (!job) return responseReturn(res, 404, { error: 'Job not found' });

            responseReturn(res, 200, { message: 'Job updated successfully', job });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    deleteJob = async (req, res) => {
        try {
            const { id } = req.params;
            // Maybe soft delete? For now hard delete as per request
            await Job.findByIdAndDelete(id);
            responseReturn(res, 200, { message: 'Job deleted successfully' });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Toggle status specifically for "Pause" action
    pauseJob = async (req, res) => {
        try {
            const { id } = req.params;
            const job = await Job.findById(id);
            if (!job) return responseReturn(res, 404, { error: 'Job not found' });

            job.status = job.status === 'paused' ? 'active' : 'paused';
            await job.save();

            responseReturn(res, 200, { message: `Job ${job.status === 'paused' ? 'paused' : 'resumed'} successfully`, job });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new AdminJobController();
