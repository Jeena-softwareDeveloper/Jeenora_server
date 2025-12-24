const express = require("express");
const router = express.Router();
const resumeRequestController = require("../../controllers/hire/resumeRequestController");

const { authMiddleware } = require("../../middlewares/authMiddleware");


// User creates a resume request (send job name, resume, and user ID)
router.post("/", authMiddleware, resumeRequestController.createResumeRequest); // #swagger.tags = ['Hire Resume']

// Resume Editor updates the resume after editing
router.put("/:editorId/edit", resumeRequestController.updateResumeByEditor); // #swagger.tags = ['Hire Resume']

// User fetches the edited resume
router.get("/:requestId/updated-resume", resumeRequestController.getUpdatedResume); // #swagger.tags = ['Hire Resume']

// Delete resume request
router.delete("/:requestId", resumeRequestController.deleteResumeRequest); // #swagger.tags = ['Hire Resume']

// Review Flow
router.post("/:requestId/approve", resumeRequestController.approveResume); // #swagger.tags = ['Hire Resume']
router.post("/:requestId/reject", resumeRequestController.rejectResume); // #swagger.tags = ['Hire Resume']
router.get("/eta", resumeRequestController.getETA); // #swagger.tags = ['Hire Resume']



module.exports = router;
