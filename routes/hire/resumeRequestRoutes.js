const express = require("express");
const router = express.Router();
const resumeRequestController = require("../../controllers/hire/resumeRequestController");


// User creates a resume request (send job name, resume, and user ID)
router.post("/resume-requests", resumeRequestController.createResumeRequest); // #swagger.tags = ['Hire Resume']

// Resume Editor updates the resume after editing
router.put("/resume-requests/:editorId/edit", resumeRequestController.updateResumeByEditor); // #swagger.tags = ['Hire Resume']

// User fetches the edited resume
router.get("/resume-requests/:requestId/updated-resume", resumeRequestController.getUpdatedResume); // #swagger.tags = ['Hire Resume']

// Delete resume request
router.delete("/resume-requests/:requestId", resumeRequestController.deleteResumeRequest); // #swagger.tags = ['Hire Resume']

// Review Flow
router.post("/resume-requests/:requestId/approve", resumeRequestController.approveResume); // #swagger.tags = ['Hire Resume']
router.post("/resume-requests/:requestId/reject", resumeRequestController.rejectResume); // #swagger.tags = ['Hire Resume']
router.get("/resume-requests/eta", resumeRequestController.getETA); // #swagger.tags = ['Hire Resume']



module.exports = router;
