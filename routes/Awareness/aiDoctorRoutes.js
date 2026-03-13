const router = require('express').Router();
const aiDoctorController = require('../../controllers/Awareness/AIDoctorController');

router.post('/ai-doctor/analyze', aiDoctorController.analyze_disease);
router.get('/ai-doctor/history', aiDoctorController.get_history);
router.delete('/ai-doctor/history/:id', aiDoctorController.delete_record);

module.exports = router;
