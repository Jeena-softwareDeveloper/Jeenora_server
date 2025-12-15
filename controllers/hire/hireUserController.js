const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;

const { responseReturn } = require("../../utiles/response");
const hireUserModel = require("../../models/hire/hireUserModel");
const Skill = require("../../models/hire/skillModel");

// Configure Cloudinary once
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class HireUserController {
  createProfile = async (req, res) => {
    try {
      const { name, phone, location, education, experience, skills, salary, noticeperiod } = req.body;

      const user = await hireUserModel.findById(req.id);
      if (!user) return responseReturn(res, 404, { error: "User not found" });

      // Basic validation
      if (!name || !phone) {
        return responseReturn(res, 400, { error: "Name and phone are required" });
      }

      const updateData = {
        name,
        phone,
        location: location || user.location || "",
        education: education || user.education || "",
        experience: experience || user.experience || null,
        salary: salary || user.salary || null,
        noticeperiod: noticeperiod || user.noticeperiod || null
      };

      // Validate skills if provided
      if (skills && Array.isArray(skills) && skills.length) {
        const validSkills = await Skill.find({ _id: { $in: skills } });
        if (validSkills.length !== skills.length) {
          return responseReturn(res, 400, { error: "Invalid skill(s) selected" });
        }
        updateData.skills = skills;
      }

      // Determine profile completion
      updateData.profileCompleted = !!(
        updateData.name &&
        user.email &&
        updateData.phone &&
        updateData.location &&
        updateData.education
      );

      const updatedUser = await hireUserModel
        .findByIdAndUpdate(req.id, updateData, { new: true })
        .select("-password")
        .populate("skills", "name description");

      return responseReturn(res, 201, {
        message: "Profile created successfully",
        user: updatedUser,
      });

    } catch (error) {
      console.error("Create profile error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };


  getProfile = async (req, res) => {
    try {
      const user = await hireUserModel
        .findById(req.id)
        .select("-password")
        .populate("skills", "name description");

      if (!user) return responseReturn(res, 404, { error: "User not found" });

      return responseReturn(res, 200, { user });
    } catch (error) {
      console.error("Get profile error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };

  updateProfile = async (req, res) => {
    try {
      const { name, phone, location, education, experience, skills, salary, noticeperiod } = req.body;

      const user = await hireUserModel.findById(req.id);
      if (!user) return responseReturn(res, 404, { error: "User not found" });

      const updateData = {};

      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (location) updateData.location = location;
      if (education) updateData.education = education;
      if (experience !== undefined) updateData.experience = experience;
      if (salary !== undefined) updateData.salary = salary;
      if (noticeperiod !== undefined) updateData.noticeperiod = noticeperiod;

      // Validate skills if provided
      if (skills !== undefined) {
        if (!Array.isArray(skills)) {
          return responseReturn(res, 400, { error: "Skills must be an array of IDs" });
        }

        if (skills.length > 0) {
          const validSkills = await Skill.find({ _id: { $in: skills } });
          if (validSkills.length !== skills.length) {
            return responseReturn(res, 400, { error: "Invalid skill(s) selected" });
          }
        }

        updateData.skills = skills;
      }

      // Profile completeness check
      const finalName = updateData.name || user.name;
      const finalPhone = updateData.phone || user.phone;
      const finalLocation = updateData.location || user.location;
      const finalEducation = updateData.education || user.education;
      updateData.profileCompleted = !!(
        finalName &&
        user.email &&
        finalPhone &&
        finalLocation &&
        finalEducation
      );

      const updatedUser = await hireUserModel
        .findByIdAndUpdate(req.id, updateData, { new: true })
        .select("-password")
        .populate("skills", "name description");

      return responseReturn(res, 200, {
        message: "Profile updated successfully",
        user: updatedUser,
      });

    } catch (error) {
      console.error("Update profile error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };


  deleteProfile = async (req, res) => {
    try {
      const user = await hireUserModel.findById(req.id);
      if (!user) return responseReturn(res, 404, { error: "User not found" });

      // Reset profile fields but keep essential info
      user.skills = [];
      user.location = "";
      user.education = "";
      user.latitude = null;
      user.longitude = null;
      user.experience = null;
      user.resumeUrl = null;
      user.profileImageUrl = null;
      user.profileImagePublicId = null;
      user.profileCompleted = false;

      await user.save();

      const cleanUser = await hireUserModel
        .findById(req.id)
        .select("-password")
        .populate("skills", "name description");

      return responseReturn(res, 200, {
        message: "Profile data cleared successfully",
        user: cleanUser,
      });

    } catch (error) {
      console.error("Delete profile error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };

  uploadProfileImage = async (req, res) => {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return responseReturn(res, 400, { error: "Image upload failed" });
      }

      const image = files.image;
      if (!image) {
        return responseReturn(res, 400, { error: "Profile image is required" });
      }

      // Validate file type
      const allowedExt = ["jpg", "jpeg", "png", "webp"];
      const ext = image.originalFilename.split(".").pop().toLowerCase();
      if (!allowedExt.includes(ext)) {
        return responseReturn(res, 400, { error: "Only JPG, JPEG, PNG, WEBP allowed" });
      }

      // Validate file size
      if (image.size > 3 * 1024 * 1024) {
        return responseReturn(res, 400, { error: "Image must be less than 3MB" });
      }

      try {
        const user = await hireUserModel.findById(req.id);
        if (!user) {
          return responseReturn(res, 404, { error: "User not found" });
        }

        // Delete old profile image if exists
        if (user.profileImagePublicId) {
          await cloudinary.uploader.destroy(user.profileImagePublicId);
        }

        const uploadResult = await cloudinary.uploader.upload(image.filepath, {
          folder: "profile-images",
          public_id: `profile_${req.id}_${Date.now()}`,
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" }
          ]
        });

        user.profileImageUrl = uploadResult.secure_url;
        user.profileImagePublicId = uploadResult.public_id;
        await user.save();

        const populatedUser = await hireUserModel
          .findById(req.id)
          .select("-password")
          .populate("skills", "name description");

        return responseReturn(res, 200, {
          message: "Profile image uploaded successfully",
          user: populatedUser,
        });

      } catch (error) {
        console.error("Upload profile image error:", error);
        return responseReturn(res, 500, { error: "Profile image upload failed" });
      }
    });
  };

  deleteProfileImage = async (req, res) => {
    try {
      const user = await hireUserModel.findById(req.id);
      if (!user) {
        return responseReturn(res, 404, { error: "User not found" });
      }

      if (user.profileImagePublicId) {
        await cloudinary.uploader.destroy(user.profileImagePublicId);
      }

      user.profileImageUrl = null;
      user.profileImagePublicId = null;
      await user.save();

      const updatedUser = await hireUserModel
        .findById(req.id)
        .select("-password")
        .populate("skills", "name description");

      return responseReturn(res, 200, {
        message: "Profile image deleted successfully",
        user: updatedUser,
      });

    } catch (error) {
      console.error("Delete profile image error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };

  getUserSkills = async (req, res) => {
    try {
      const user = await hireUserModel
        .findById(req.id)
        .select("skills")
        .populate("skills", "name description");

      if (!user) return responseReturn(res, 404, { error: "User not found" });

      return responseReturn(res, 200, {
        skills: user.skills,
        message: "User skills fetched successfully",
      });

    } catch (error) {
      console.error("Get user skills error:", error);
      return responseReturn(res, 500, { error: "Failed to fetch user skills" });
    }
  };

  uploadResume = async (req, res) => {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return responseReturn(res, 400, { error: "File upload failed" });
      }

      const file = files.resume;
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
        const user = await hireUserModel.findById(req.id);
        if (!user) {
          return responseReturn(res, 404, { error: "User not found" });
        }

        const uploadResult = await cloudinary.uploader.upload(file.filepath, {
          folder: "resumes",
          resource_type: "raw",
          public_id: `resume_${req.id}_${Date.now()}`
        });

        user.resumeUrl = uploadResult.secure_url;
        await user.save();

        const updatedUser = await hireUserModel
          .findById(req.id)
          .select("-password")
          .populate("skills", "name description");

        return responseReturn(res, 200, {
          message: "Resume uploaded successfully",
          user: updatedUser,
        });

      } catch (error) {
        console.error("Upload resume error:", error);
        return responseReturn(res, 500, { error: "Resume upload failed" });
      }
    });
  };

  deleteResume = async (req, res) => {
    try {
      const user = await hireUserModel.findById(req.id);
      if (!user) {
        return responseReturn(res, 404, { error: "User not found" });
      }

      user.resumeUrl = null;
      await user.save();

      const updatedUser = await hireUserModel
        .findById(req.id)
        .select("-password")
        .populate("skills", "name description");

      return responseReturn(res, 200, {
        message: "Resume deleted successfully",
        user: updatedUser,
      });

    } catch (error) {
      console.error("Delete resume error:", error);
      return responseReturn(res, 500, { error: "Internal Server Error" });
    }
  };

  // New Methods from Flowchart
  checkProfileStatus = async (req, res) => {
    try {
      const user = await hireUserModel.findById(req.id);
      if (!user) return responseReturn(res, 404, { error: "User not found" });

      const requiredFields = ['name', 'email', 'phone', 'education', 'skills', 'resumeUrl'];
      const missing = requiredFields.filter(field => {
        if (field === 'skills') return !user.skills || user.skills.length === 0;
        return !user[field];
      });

      const isComplete = missing.length === 0;
      if (user.profileCompleted !== isComplete) {
        user.profileCompleted = isComplete;
        await user.save();
      }

      responseReturn(res, 200, {
        complete: isComplete,
        missing: missing,
        percentage: Math.round(((requiredFields.length - missing.length) / requiredFields.length) * 100)
      });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  }

  updatePreferences = async (req, res) => {
    try {
      const { jobPreferences } = req.body;
      const user = await hireUserModel.findByIdAndUpdate(
        req.id,
        { jobPreferences },
        { new: true }
      );
      responseReturn(res, 200, { message: "Preferences updated", preferences: user.jobPreferences });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  }

  analyzeResume = async (req, res) => {
    try {
      // Mock AI Analysis for now
      setTimeout(() => { }, 1000); // Simulate delay
      responseReturn(res, 200, {
        score: 85,
        suggestions: [
          "Add quantitative results to your experience",
          "Include more industry keywords",
          "Check for spelling errors"
        ],
        keywordsFound: ["Javascript", "React", "Node.js"]
      });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  }

  getResumeVersions = async (req, res) => {
    try {
      // Currently only supporting single current resume in model. 
      // Returning current resume as a 'version'.
      const user = await hireUserModel.findById(req.id);
      responseReturn(res, 200, {
        versions: user.resumeUrl ? [{
          url: user.resumeUrl,
          uploadedAt: new Date(), // Mock date as we don't track history yet
          version: 1
        }] : []
      });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  }

  addResumeVersion = async (req, res) => {
    try {
      // Just calls uploadResume logic for now
      this.uploadResume(req, res);
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  }
}

module.exports = new HireUserController();