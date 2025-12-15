const mongoose = require("mongoose");

const resumeRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  resumeEditorId: { type: mongoose.Schema.Types.ObjectId, ref: "Editor", required: true },
  jobName: { type: String, required: true },
  userResume: { type: String, required: true },
  editorResume: { type: String }, 
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  requestDate: { type: Date, default: Date.now },
  responseDate: { type: Date },
});

const ResumeRequest = mongoose.model("ResumeRequest", resumeRequestSchema);

module.exports = ResumeRequest;
