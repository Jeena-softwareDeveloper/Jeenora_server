const { responseReturn } = require("../../utiles/response");
const ResumeEditRequest = require("../../models/hire/resumeEditRequestModel");
const HireUser = require("../../models/hire/hireUserModel");
const Resume = require("../../models/hire/resumeModel");

class HireResumeEditorController {

    // Create a new edit request
    createEditRequest = async (req, res) => {
        try {
            const { currentResumeId, targetRole, requirements, jobId } = req.body;

            if (!currentResumeId || !targetRole) {
                return responseReturn(res, 400, { error: "Resume and Target Role are required" });
            }

            // Check credits logic (simplified placeholder)
            const user = await HireUser.findById(req.id);
            if (user.creditBalance < 1) { // Assuming 1 credit per request for now
                return responseReturn(res, 400, { error: "Insufficient credits" });
            }

            const request = await ResumeEditRequest.create({
                userId: req.id,
                currentResumeId,
                targetRole,
                requirements,
                jobId,
                creditsUsed: 1, // deduct 1
                paymentStatus: 'PAID', // Assuming credits deducted immediately
                editorStatus: 'ASSIGNED'
            });

            // Deduct credit
            user.creditBalance -= 1;
            await user.save();

            return responseReturn(res, 201, { message: "Resume edit request submitted", request });

        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };

    // Get user requests
    getUserRequests = async (req, res) => {
        try {
            const requests = await ResumeEditRequest.find({ userId: req.id })
                .populate('currentResumeId', 'resumeTitle')
                .sort({ createdAt: -1 });
            return responseReturn(res, 200, { requests });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };

    // Get single request details
    getRequestDetails = async (req, res) => {
        const { id } = req.params;
        try {
            const request = await ResumeEditRequest.findOne({ _id: id, userId: req.id });
            if (!request) return responseReturn(res, 404, { error: "Request not found" });
            return responseReturn(res, 200, { request });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };
}

module.exports = new HireResumeEditorController();
