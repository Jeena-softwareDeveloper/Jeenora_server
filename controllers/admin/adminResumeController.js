const Resume = require('../../models/hire/resumeModel');
const { responseReturn } = require("../../utiles/response");
const cloudinary = require('../../utiles/cloudinary');

class AdminResumeController {

    // Get all resumes
    getResumes = async (req, res) => {
        try {
            const { page = 1, limit = 10, search } = req.query;
            const skip = (page - 1) * limit;

            const query = {};

            if (search) {
                query.resumeTitle = { $regex: search, $options: 'i' };
            }

            const resumes = await Resume.find(query)
                .populate('userId', 'name email')
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ uploadedAt: -1 });

            const total = await Resume.countDocuments(query);

            responseReturn(res, 200, { resumes, total });

        } catch (error) {
            console.error('Get Resumes Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete Resume
    deleteResume = async (req, res) => {
        try {
            const { id } = req.params;
            const resume = await Resume.findById(id);
            if (!resume) return responseReturn(res, 404, { error: 'Resume not found' });

            // Delete from Cloudinary
            if (resume.publicId) {
                try {
                    await cloudinary.uploader.destroy(resume.publicId);
                } catch (cError) {
                    console.error('Cloudinary Delete Error:', cError);
                    // Continue to delete from DB even if Cloudinary fails
                }
            }

            await Resume.findByIdAndDelete(id);
            responseReturn(res, 200, { message: 'Resume deleted successfully' });
        } catch (error) {
            console.error('Delete Resume Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new AdminResumeController();
