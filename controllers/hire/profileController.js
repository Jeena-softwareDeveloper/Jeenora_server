const HireProfile = require('../../models/hire/ProfileModel');
const HireUser = require('../../models/hire/hireUserModel');
const { responseReturn } = require('../../utiles/response');

class ProfileController {

    calculateCompletion = (profile) => {
        let score = 0;

        // Personal Details: 25% (Increased weight)
        if (profile.personalDetails) {
            if (profile.personalDetails.fullName) score += 5;
            if (profile.personalDetails.phone) score += 5;
            if (profile.personalDetails.dateOfBirth) score += 5;
            if (profile.personalDetails.gender) score += 5;
            if (profile.personalDetails.address && profile.personalDetails.address.city) score += 5;
        }

        // Professional Summary: 25% (Increased weight)
        if (profile.professionalSummary) {
            if (profile.professionalSummary.professionalHeadline) score += 10;
            if (profile.professionalSummary.summary) score += 5;
            // Allow credit for either currentRole or totalExperience being present
            if (profile.professionalSummary.currentRole || profile.professionalSummary.totalExperience) score += 10;
        }

        // Education: 15%
        // Check array length OR if legacy string exists (though model is array now, be safe)
        if ((profile.education && profile.education.length > 0) || (profile.education && typeof profile.education === 'string')) score += 15;

        // Skills: 15%
        if (profile.skills && (profile.skills.technical?.length > 0 || profile.skills.softSkills?.length > 0)) score += 15;

        // Career Preferences / Salary / Notice Period: 20% (Redistributed Work Exp weight since user might be a fresher)
        // Check notice period in professionalSummary
        if (profile.professionalSummary?.noticePeriod) score += 10;

        // Check expected salary in careerPreferences
        if (profile.careerPreferences?.salaryExpectations?.maxAnnual) score += 10;

        // Bonus: Work Experience (Optional but adds to score if present, capping at 100)
        if (profile.workExperience && profile.workExperience.length > 0) score += 10;

        return Math.min(score, 100);
    }

    getProfile = async (req, res) => {
        const userId = req.id;
        try {
            let profile = await HireProfile.findOne({ user: userId }).populate('user', 'name email phone profileImageUrl resumeEditorEnabled');

            if (!profile) {
                const user = await HireUser.findById(userId);
                if (user) {
                    profile = await HireProfile.create({
                        user: userId,
                        personalDetails: {
                            fullName: user.name,
                            email: user.email,
                            phone: user.phone
                        }
                    });
                    // Re-fetch to Populate if needed or just return this
                    profile = await HireProfile.findOne({ user: userId }).populate('user', 'name email phone profileImageUrl');
                } else {
                    return responseReturn(res, 404, { error: "User not found" });
                }
            }
            return responseReturn(res, 200, { profile });
        } catch (error) {
            console.log(error.message);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    updateProfile = async (req, res) => {
        const userId = req.id;
        const { personalDetails, professionalSummary, careerPreferences, education, workExperience, skills, certifications, projects } = req.body;

        try {
            let profile = await HireProfile.findOne({ user: userId });
            if (!profile) {
                profile = new HireProfile({ user: userId });
            }

            if (personalDetails) {
                // Ensure we don't overwrite with empty if partial update, but explicit nulls might be intended. 
                // Mongoose usage: profile.personalDetails.someField = ...
                // If specific fields are sent:
                // We use spread to merge.
                profile.personalDetails = { ...profile.personalDetails?.toObject(), ...personalDetails };
            }
            if (professionalSummary) {
                profile.professionalSummary = { ...profile.professionalSummary?.toObject(), ...professionalSummary };
            }
            if (careerPreferences) {
                profile.careerPreferences = { ...profile.careerPreferences?.toObject(), ...careerPreferences };
            }
            if (skills) {
                profile.skills = { ...profile.skills?.toObject(), ...skills };
            }

            // Arrays - Replace strategy for now (form sends whole list usually)
            if (education) profile.education = education;
            if (workExperience) profile.workExperience = workExperience;
            if (certifications) profile.certifications = certifications;
            if (projects) profile.projects = projects;

            profile.completionPercentage = this.calculateCompletion(profile);
            await profile.save();

            return responseReturn(res, 200, { message: 'Profile updated successfully', profile, completionPercentage: profile.completionPercentage });
        } catch (error) {
            console.log(error.message);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    getProfileByAdmin = async (req, res) => {
        const { userId } = req.params;
        try {
            let profile = await HireProfile.findOne({ user: userId }).populate('user', 'name email phone profileImageUrl resumeEditorEnabled');
            if (!profile) {
                // Create empty if not exists so admin can edit it
                profile = await HireProfile.create({ user: userId });
                profile = await HireProfile.findOne({ user: userId }).populate('user', 'name email phone profileImageUrl resumeEditorEnabled');
            }
            return responseReturn(res, 200, { profile });
        } catch (error) {
            console.log(error.message);
            return responseReturn(res, 500, { error: error.message });
        }
    }

    updateProfileByAdmin = async (req, res) => {
        const { userId } = req.params;
        const { personalDetails, professionalSummary, careerPreferences, education, workExperience, skills, certifications, projects } = req.body;

        try {
            let profile = await HireProfile.findOne({ user: userId });
            if (!profile) {
                profile = new HireProfile({ user: userId });
            }

            if (personalDetails) {
                profile.personalDetails = { ...profile.personalDetails?.toObject(), ...personalDetails };
            }
            if (professionalSummary) {
                profile.professionalSummary = { ...profile.professionalSummary?.toObject(), ...professionalSummary };
            }
            if (careerPreferences) {
                profile.careerPreferences = { ...profile.careerPreferences?.toObject(), ...careerPreferences };
            }
            if (skills) {
                profile.skills = { ...profile.skills?.toObject(), ...skills };
            }

            if (education) profile.education = education;
            if (workExperience) profile.workExperience = workExperience;
            if (certifications) profile.certifications = certifications;
            if (projects) profile.projects = projects;

            profile.completionPercentage = this.calculateCompletion(profile);
            await profile.save();

            return responseReturn(res, 200, { message: 'Profile updated successfully', profile });
        } catch (error) {
            console.log(error.message);
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new ProfileController();
