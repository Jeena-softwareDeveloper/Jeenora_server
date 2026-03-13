const Job = require('../../models/hire/JobModel');
const HireUser = require('../../models/hire/hireUserModel');
const { responseReturn } = require("../../utiles/response");

class SavedJobController {

    toggleSaveJob = async (req, res) => {
        try {
            const { jobId } = req.body;
            const userId = req.id; // From authMiddleware

            const user = await HireUser.findById(userId);
            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }

            // Check if job exists
            const job = await Job.findById(jobId);
            if (!job) {
                return responseReturn(res, 404, { error: 'Job not found' });
            }

            const index = user.savedJobs.indexOf(jobId);
            let message = '';
            let saved = false;

            if (index === -1) {
                // Add to saved
                user.savedJobs.push(jobId);
                message = 'Job saved successfully';
                saved = true;
            } else {
                // Remove from saved
                user.savedJobs.splice(index, 1);
                message = 'Job removed from saved list';
                saved = false;
            }

            await user.save();

            responseReturn(res, 200, { message, saved, savedJobs: user.savedJobs });

        } catch (error) {
            console.error('Toggle Save Job Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    getSavedJobs = async (req, res) => {
        try {
            const userId = req.id;
            const user = await HireUser.findById(userId).populate('savedJobs');

            if (!user) {
                return responseReturn(res, 404, { error: 'User not found' });
            }

            responseReturn(res, 200, {
                savedJobs: user.savedJobs,
                count: user.savedJobs.length
            });

        } catch (error) {
            console.error('Get Saved Jobs Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new SavedJobController();
