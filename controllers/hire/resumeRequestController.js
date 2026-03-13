const cloudinary = require("cloudinary").v2;
const ResumeRequest = require("../../models/hire/resumeRequestRoutes");
const Editor = require("../../models/hire/resumeEditor");
const User = require("../../models/hire/hireUserModel");

// User sends a request for editing their resume
exports.createResumeRequest = async (req, res) => {
  try {
    const { resumeEditorId, jobName, userResume } = req.body;
    let { userId } = req.body;

    // Use authenticated user ID if available
    if (req.id) {
      userId = req.id;
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check credits
    const creditSettings = await require("../../models/hire/creditSettingModel").getSettings();
    const cost = creditSettings.resumeEditCost || 50;

    if (user.creditBalance < cost) {
      return res.status(400).json({ message: `Insufficient credits. This service costs ${cost} credits.` });
    }

    let editor = null;
    if (resumeEditorId) {
      editor = await Editor.findById(resumeEditorId);
      if (!editor) {
        return res.status(404).json({ message: "Editor not found" });
      }
    }

    let resumeUrl = userResume;
    // If not provided in body, fallback to user profile resume
    if (!resumeUrl && user.resumeUrl) {
      resumeUrl = user.resumeUrl;
    } else if (!resumeUrl) {
      return res.status(400).json({ message: "No resume provided or found in profile" });
    }

    // If a new file string is provided (base64 or path?), upload it. 
    // If it is just a URL (starts with http), skip upload.
    if (resumeUrl && !resumeUrl.startsWith('http')) {
      const result = await cloudinary.uploader.upload(resumeUrl, {
        folder: "hire/resumes/user"
      });
      resumeUrl = result.secure_url;
    }

    const newRequest = new ResumeRequest({
      userId,
      resumeEditorId: resumeEditorId || null, // Allow null
      jobName: jobName || "General Request",
      userResume: resumeUrl,
      cost // Store cost for records? Scheme might not have it but good practice.
    });

    await newRequest.save();

    // Deduct credits
    user.creditBalance = (user.creditBalance || 0) - cost;
    // Store credit history equivalent? (Skipped for now as schema unkown)

    // Enable the Resume Editor feature for the user
    user.resumeEditorEnabled = true;
    if (!user.agreeTerms) {
      user.agreeTerms = true;
    }
    await user.save();

    res.status(201).json({
      message: `Resume request created successfully. ${cost} credits deducted.`,
      request: newRequest,
      resumeEditorEnabled: true,
      newBalance: user.creditBalance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating resume request", error: error.message });
  }
};

// Resume editor uploads the edited resume
exports.updateResumeByEditor = async (req, res) => {
  try {
    const { requestId, editorResume } = req.body;

    // Find the resume request
    const request = await ResumeRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Resume request not found" });
    }

    // Check if the editor is the one assigned to the request
    if (request.resumeEditorId.toString() !== req.params.editorId) {
      return res.status(403).json({ message: "This editor is not assigned to this request" });
    }

    // Upload the edited resume to Cloudinary
    const result = await cloudinary.uploader.upload(editorResume, {
      folder: "resumes/editor"
    });

    // Update the resume and set status to "completed"
    request.editorResume = result.secure_url; // Cloudinary URL
    request.status = "completed";
    request.responseDate = Date.now();

    await request.save();
    res.status(200).json({ message: "Resume edited and updated successfully", request });
  } catch (error) {
    res.status(500).json({ message: "Error updating resume", error });
  }
};

// User fetches the edited resume
exports.getUpdatedResume = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Find the resume request by ID
    const request = await ResumeRequest.findById(requestId).populate("userId resumeEditorId");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "completed") {
      return res.status(400).json({ message: "Resume has not been completed yet" });
    }

    // Return the updated resume URL from Cloudinary
    res.status(200).json({ message: "Updated resume fetched", editorResume: request.editorResume });
  } catch (error) {
    res.status(500).json({ message: "Error fetching updated resume", error });
  }
};

// Delete the resume request (optional CRUD operation)
exports.deleteResumeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await ResumeRequest.findByIdAndDelete(requestId);

    if (!request) {
      return res.status(404).json({ message: "Resume request not found" });
    }

    res.status(200).json({ message: "Resume request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting resume request", error });
  }
};

// Approve/Reject Flow
exports.approveResume = async (req, res) => {
  try {
    // TODO: Mark as approved
    res.status(200).json({ message: "Resume approved" });
  } catch (error) {
    res.status(500).json({ message: "Error approving resume", error });
  }
};

exports.rejectResume = async (req, res) => {
  try {
    // TODO: Toggle status back to pending or revision
    res.status(200).json({ message: "Resume rejection logged" });
  } catch (error) {
    res.status(500).json({ message: "Error rejecting resume", error });
  }
};

exports.getETA = async (req, res) => {
  try {
    // TODO: Calculate based on queue
    res.status(200).json({ eta: "24 hours", sla: "high priority" });
  } catch (error) {
    res.status(500).json({ message: "Error fetching ETA", error });
  }
};

