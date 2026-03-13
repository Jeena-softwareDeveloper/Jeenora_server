const Job = require('../../models/hire/JobModel');
const { responseReturn } = require("../../utiles/response");

class SearchJobController {

    getJobs = async (req, res) => {
        try {
            const {
                search,
                location,
                experienceMax, // Map from query
                experienceMin,
                salaryMin,
                salaryMax,
                jobType, // Array or string
                page = 1,
                limit = 20,
                sortBy = 'recent'
            } = req.query;

            const query = { status: 'active' };

            // Search Text
            if (search) {
                query.$text = { $search: search };
            }

            // Location (Simple regex or exact match depending on implementation)
            if (location) {
                // Handle array or single string
                const locs = Array.isArray(location) ? location : [location];
                // Regex match for any of the locations
                query['location.city'] = { $in: locs.map(l => new RegExp(l, 'i')) };
            }

            // Experience
            if (experienceMin || experienceMax) {
                query['requirements.experience.min'] = {};
                if (experienceMin) query['requirements.experience.min'].$gte = Number(experienceMin);
                // For max, we usually check if job requires less than user has, or overlap. 
                // Let's implement simple filter: Job.experience.max <= UserFilter.min or simple range.
                // Prompt: "experience: {min: 2, max: 5}" -> Jobs requiring between 2 and 5.
                if (experienceMax) query['requirements.experience.max'] = { $lte: Number(experienceMax) };
            }

            // Salary
            if (salaryMin) {
                query['salary.min'] = { $gte: Number(salaryMin) };
            }
            if (salaryMax) {
                query['salary.max'] = { $lte: Number(salaryMax) };
            }

            // Job Type
            if (jobType) {
                const types = Array.isArray(jobType) ? jobType : [jobType];
                query.jobType = { $in: types };
            }

            // Sorting
            let sort = {};
            if (sortBy === 'recent') sort.postedDate = -1;
            else if (sortBy === 'salary_high') sort['salary.max'] = -1;
            else if (sortBy === 'credits_low') sort['application.creditsRequired'] = 1;

            const jobs = await Job.find(query)
                .sort(sort)
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit));

            const total = await Job.countDocuments(query);

            responseReturn(res, 200, {
                jobs,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                filtersApplied: req.query
            });

        } catch (error) {
            console.error("Search Error:", error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getJobById = async (req, res) => {
        try {
            const { id } = req.params;
            const job = await Job.findById(id).populate('postedBy', 'name company'); // Adjust population as needed

            if (!job) {
                return responseReturn(res, 404, { error: "Job not found" });
            }

            // Update views stats (simple increment)
            await Job.findByIdAndUpdate(id, { $inc: { 'stats.totalViews': 1 } });

            responseReturn(res, 200, { job });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new SearchJobController();
