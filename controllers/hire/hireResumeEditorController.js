const ResumeEditRequest = require("../../models/hire/resumeEditRequestModel");
const HireUser = require("../../models/hire/hireUserModel");
const Resume = require("../../models/hire/resumeModel");
const ResumeEditor = require("../../models/hire/resumeEditor");
const { responseReturn } = require("../../utiles/response");

class HireResumeEditorController {

    // Create a new edit request
    createEditRequest = async (req, res) => {
        try {
            const { currentResumeId, targetRole, requirements, jobId, editorId } = req.body;

            if (!currentResumeId || !targetRole || !editorId) {
                return responseReturn(res, 400, { error: "Resume, Target Role, and Editor are required" });
            }

            const editor = await ResumeEditor.findById(editorId);
            if (!editor) {
                return responseReturn(res, 404, { error: "Editor not found" });
            }

            const costInCredits = editor.price;

            // Check credits logic
            const user = await HireUser.findById(req.id);
            if (user.creditBalance < costInCredits) {
                return responseReturn(res, 400, { error: `Insufficient credits. This service costs ${costInCredits} credits.` });
            }

            const request = await ResumeEditRequest.create({
                userId: req.id,
                currentResumeId,
                targetRole,
                requirements,
                jobId,
                editorId,
                creditsUsed: costInCredits,
                paymentStatus: 'PAID',
                editorStatus: 'ASSIGNED'
            });

            // Deduct credit
            user.creditBalance -= costInCredits;
            await user.save();

            return responseReturn(res, 201, { message: "Resume edit request submitted successfully", request, remainingCredits: user.creditBalance });

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
