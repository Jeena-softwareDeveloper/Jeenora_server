const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;
const { responseReturn } = require("../../utiles/response");
const Resume = require("../../models/hire/resumeModel");
const HireUser = require("../../models/hire/hireUserModel");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

class HireResumeController {

    // Upload a resume
    uploadResume = async (req, res) => {
        const form = formidable({ multiples: false });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 400, { error: "File upload failed" });
            }

            const file = Array.isArray(files.resume) ? files.resume[0] : files.resume;
            const { resumeTitle, isPrimary } = fields;

            if (!file) {
                return responseReturn(res, 400, { error: "No resume uploaded" });
            }

            // Validate file type
            const allowed = ["pdf", "doc", "docx"];
            const ext = file.originalFilename.split(".").pop().toLowerCase();
            if (!allowed.includes(ext)) {
                return responseReturn(res, 400, { error: "Only PDF, DOC, DOCX allowed" });
            }

            // Validate file size
            if (file.size > 5 * 1024 * 1024) {
                return responseReturn(res, 400, { error: "File must be less than 5MB" });
            }

            try {
                const user = await HireUser.findById(req.id);
                if (!user) return responseReturn(res, 404, { error: "User not found" });

                const uploadResult = await cloudinary.uploader.upload(file.filepath, {
                    folder: "hire/resumes",
                    resource_type: "raw",
                    public_id: `resume_${req.id}_${Date.now()}`
                });

                // Create new resume record
                const newResume = await Resume.create({
                    userId: req.id,
                    resumeTitle: Array.isArray(resumeTitle) ? resumeTitle[0] : (resumeTitle || file.originalFilename),
                    fileUrl: uploadResult.secure_url,
                    fileType: ext.toUpperCase(),
                    publicId: uploadResult.public_id,
                    isPrimary: isPrimary === 'true' || isPrimary === true
                });

                // If this is primary, unset other primaries
                if (newResume.isPrimary) {
                    await Resume.updateMany(
                        { userId: req.id, _id: { $ne: newResume._id } },
                        { isPrimary: false }
                    );
                    await HireUser.findByIdAndUpdate(req.id, { resumeUrl: newResume.fileUrl });
                } else {
                    // If no primary exists, make this one primary
                    const count = await Resume.countDocuments({ userId: req.id });
                    if (count === 1) {
                        newResume.isPrimary = true;
                        await newResume.save();
                        await HireUser.findByIdAndUpdate(req.id, { resumeUrl: newResume.fileUrl });
                    }
                }

                return responseReturn(res, 201, {
                    message: "Resume uploaded successfully",
                    resume: newResume
                });

            } catch (error) {
                console.error("Upload resume error:", error);
                return responseReturn(res, 500, { error: error.message });
            }
        });
    };

    // Get all resumes for user
    getResumes = async (req, res) => {
        try {
            const resumes = await Resume.find({ userId: req.id }).sort({ uploadedAt: -1 });
            return responseReturn(res, 200, { resumes });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };

    // Delete a resume
    deleteResume = async (req, res) => {
        const { resumeId } = req.params;
        try {
            const resume = await Resume.findOne({ _id: resumeId, userId: req.id });
            if (!resume) return responseReturn(res, 404, { error: 'Resume not found' });

            // Delete from cloud
            if (resume.publicId) {
                try {
                    await cloudinary.uploader.destroy(resume.publicId, { resource_type: 'raw' });
                } catch (e) {
                    console.error("Cloudinary delete error", e);
                }
            }

            // Delete from db
            await Resume.deleteOne({ _id: resumeId });

            // If it was primary, check if others exist and make latest primary
            if (resume.isPrimary) {
                const latest = await Resume.findOne({ userId: req.id }).sort({ uploadedAt: -1 });
                if (latest) {
                    latest.isPrimary = true;
                    await latest.save();
                    // Update user
                    await HireUser.findByIdAndUpdate(req.id, { resumeUrl: latest.fileUrl });
                } else {
                    await HireUser.findByIdAndUpdate(req.id, { resumeUrl: null });
                }
            }

            return responseReturn(res, 200, { message: 'Resume deleted successfully' });

        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };

    // Set resume as primary
    setPrimaryResume = async (req, res) => {
        const { resumeId } = req.params;
        try {
            // Unset all
            await Resume.updateMany({ userId: req.id }, { isPrimary: false });

            // Set specific one
            const updated = await Resume.findOneAndUpdate(
                { _id: resumeId, userId: req.id },
                { isPrimary: true },
                { new: true }
            );

            if (!updated) return responseReturn(res, 404, { error: 'Resume not found' });

            // Update user profile
            await HireUser.findByIdAndUpdate(req.id, { resumeUrl: updated.fileUrl });

            return responseReturn(res, 200, { message: 'Primary resume updated', resume: updated });

        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    };
}

module.exports = new HireResumeController();
