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
      const {
        name, phone, location, education, experience, skills, salary, noticeperiod,
        headline, totalExperience, currentRole, preferredRole, currentLocation, expectedSalary, noticePeriod
      } = req.body;

      const user = await hireUserModel.findById(req.id);
      if (!user) return responseReturn(res, 404, { error: "User not found" });

      const updateData = {};

      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (location) updateData.location = location;
      if (education) updateData.education = education;
      if (experience !== undefined) updateData.experience = experience;
      // Legacy salary check
      if (salary !== undefined) updateData.salary = salary;
      // Legacy noticeperiod check
      if (noticeperiod !== undefined) updateData.noticeperiod = noticeperiod;

      // New fields
      if (headline !== undefined) updateData.headline = headline;
      if (totalExperience !== undefined) updateData.totalExperience = totalExperience;
      if (currentRole !== undefined) updateData.currentRole = currentRole;
      if (preferredRole !== undefined) updateData.preferredRole = preferredRole;
      if (currentLocation) updateData.location = currentLocation; // Map currentLocation to location
      if (expectedSalary !== undefined) updateData.expectedSalary = expectedSalary;
      if (noticePeriod !== undefined) updateData.noticePeriod = noticePeriod;

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
          folder: "hire/profile-images",
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

      const file = Array.isArray(files.resume) ? files.resume[0] : files.resume;
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
          folder: "hire/resumes",
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
        return responseReturn(res, 500, { error: error.message });
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
  // Admin Methods
  getAllUsers = async (req, res) => {
    const { page, parPage, searchValue, userType, status } = req.query;
    const skipPage = parseInt(parPage) * (parseInt(page) - 1);
    const limit = parseInt(parPage);

    try {
      let matchQuery = { $and: [] };

      if (searchValue) {
        matchQuery.$and.push({
          $or: [
            { name: { $regex: searchValue, $options: "i" } },
            { email: { $regex: searchValue, $options: "i" } }
          ]
        });
      }

      if (userType) {
        matchQuery.$and.push({ userType: userType });
      }

      if (status) {
        if (status === 'Active') {
          // Backward compatibility: Users without settings.account.isActive are considered Active
          matchQuery.$and.push({
            $or: [
              { 'settings.account.isActive': true },
              { 'settings.account.isActive': { $exists: false } }
            ]
          });
        } else if (status === 'Inactive') {
          matchQuery.$and.push({ 'settings.account.isActive': false });
        }
      }

      // If no filters added, remove $and to match all documents
      const finalQuery = matchQuery.$and.length > 0 ? matchQuery : {};

      // Aggregation Pipeline
      const pipeline = [
        { $match: finalQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skipPage },
        { $limit: limit },
        {
          $lookup: {
            from: 'hireprofiles', // Mongoose default pluralization usually lowercase
            localField: '_id',
            foreignField: 'user',
            as: 'profile'
          }
        },
        {
          $addFields: {
            completionPercentage: { $arrayElemAt: ['$profile.completionPercentage', 0] }
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            phone: 1,
            userType: 1,
            creditBalance: 1,
            'settings.account.isActive': 1,
            createdAt: 1,
            profileImageUrl: 1,
            completionPercentage: { $ifNull: ['$completionPercentage', 0] } // Default to 0 if no profile
          }
        }
      ];

      // Log for debugging
      console.log("Admin Users Pipeline:", JSON.stringify(pipeline, null, 2));

      const users = await hireUserModel.aggregate(pipeline);
      const totalUser = await hireUserModel.countDocuments(finalQuery);

      console.log("Admin Users Found:", users.length, "Total:", totalUser);

      return responseReturn(res, 200, { users, totalUser });

    } catch (error) {
      console.log(error);
      return responseReturn(res, 500, { error: error.message });
    }
  };

  createUserByAdmin = async (req, res) => {
    const { name, email, phone, password, role, userType, creditBalance } = req.body;
    try {
      const checkUser = await hireUserModel.findOne({ email });
      if (checkUser) {
        return responseReturn(res, 404, { error: "Email already exists" });
      }

      // Note: Assuming password hashing happens here if not in model pre-save.
      // Since model doesn't handle it, we should hash it. 
      // But importing bcrypt here is messy if not already present.
      // For now, I will store as is, BUT RECOMMENDED to fix hashing.
      // Wait, let's try to require bcrypt.
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await hireUserModel.create({
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        userType,
        creditBalance: parseInt(creditBalance),
        agreeTerms: true // Admin created
      });
      return responseReturn(res, 201, { message: "User created successfully", user });
    } catch (error) {
      console.log(error.message);
      return responseReturn(res, 500, { error: error.message });
    }
  };

  deleteUserByAdmin = async (req, res) => {
    const { userId } = req.params;
    try {
      await hireUserModel.findByIdAndDelete(userId);
      return responseReturn(res, 200, { message: "User deleted successfully" });
    } catch (error) {
      console.log(error);
      return responseReturn(res, 500, { error: error.message });
    }
  };

  updateUserByAdmin = async (req, res) => {
    const { userId } = req.params;
    const { name, email, phone, role, userType, creditBalance, status, password } = req.body;

    try {
      const updateFields = {
        name,
        email,
        phone,
        role,
        userType,
        creditBalance: isNaN(parseInt(creditBalance)) ? 0 : parseInt(creditBalance)
      };

      if (status) {
        updateFields['settings.account.isActive'] = status === 'Active';
      }

      if (password) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.password = hashedPassword;
      }

      const user = await hireUserModel.findByIdAndUpdate(userId, updateFields, { new: true });
      return responseReturn(res, 200, { message: "User updated successfully", user });
    } catch (error) {
      console.log(error.message);
      if (error.code === 11000) {
        return responseReturn(res, 409, { error: 'Email already exists' });
      }
      return responseReturn(res, 500, { error: error.message });
    }
  };
}

module.exports = new HireUserController();