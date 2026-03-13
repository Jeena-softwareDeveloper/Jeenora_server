const Skill = require('../../models/hire/skillModel');

class SkillController {

  // ---------------- CREATE SKILL ---------------- //
  addSkill = async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Skill name is required" });
      }

      // Prevent duplicates
      const exist = await Skill.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") }
      });

      if (exist) {
        return res.status(400).json({ error: "Skill already exists" });
      }

      const skill = await Skill.create({ name, description });

      res.status(201).json({
        success: true,
        message: "Skill created successfully",
        skill
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ---------------- GET ALL SKILLS ---------------- //
  getSkills = async (req, res) => {
    try {
      const skills = await Skill.find().sort({ name: 1 });

      res.json({
        success: true,
        count: skills.length,
        skills
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ---------------- GET SKILL BY ID ---------------- //
  getSkillById = async (req, res) => {
    try {
      const skill = await Skill.findById(req.params.id);

      if (!skill) {
        return res.status(404).json({ error: "Skill not found" });
      }

      res.json({ success: true, skill });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ---------------- UPDATE SKILL ---------------- //
  updateSkill = async (req, res) => {
    try {
      const { name, description } = req.body;

      // Prevent duplicate names
      if (name) {
        const exist = await Skill.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: req.params.id }
        });

        if (exist) {
          return res.status(400).json({ error: "Skill name already exists" });
        }
      }

      const updated = await Skill.findByIdAndUpdate(
        req.params.id,
        { name, description },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: "Skill not found" });
      }

      res.json({
        success: true,
        message: "Skill updated successfully",
        skill: updated
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // ---------------- DELETE SKILL ---------------- //
  deleteSkill = async (req, res) => {
    try {
      const deleted = await Skill.findByIdAndDelete(req.params.id);

      if (!deleted) {
        return res.status(404).json({ error: "Skill not found" });
      }

      res.json({
        success: true,
        message: "Skill deleted successfully",
        deletedSkill: deleted
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

module.exports = new SkillController();
