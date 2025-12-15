// routes/skillsCategoryRoutes.js
const express = require('express');
const router = express.Router();
const skillsCategoryController = require('../../controllers/hire/skillCategoryController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.post("/", authMiddleware, skillsCategoryController.addSkill);
router.get("/", skillsCategoryController.getSkills);
router.get("/:id", skillsCategoryController.getSkillById);
router.put("/:id", authMiddleware, skillsCategoryController.updateSkill);
router.delete("/:id", authMiddleware, skillsCategoryController.deleteSkill);

module.exports = router;